import {HlmButton} from '@spartan-ng/helm/button';
import {ChangeDetectorRef, Component, OnDestroy, OnInit, signal} from '@angular/core';
import {FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {SettingsService} from '../../services/settings.service';
import {GlobalSettings} from '../../models/GlobalSettings';
import {Subject} from 'rxjs';
import {filter, finalize, takeUntil} from 'rxjs/operators';

import {NotificationService} from '../../services/notification-service.service';
import {VisibleRowsDirective} from '../../shared/visible-rows.directive';
import {AdminSettingsShellComponent} from '../../shared/admin-settings-shell/admin-settings-shell.component';
import {AdminSettingsHeaderComponent} from '../../shared/admin-settings-shell/admin-settings-header.component';

type TimerControl = 'days' | 'hours' | 'minutes' | 'seconds';
type BlacklistTimer = GlobalSettings['blacklist_timer'];

/** Problems found in the lists before saving. Each array lines up with its form array. */
export interface BlacklistIssues {
  sources: (string | null)[];
  sites: (string | null)[];
  sourceCount: number;
  siteCount: number;
  total: number;
}

const DEFAULT_TIMER: BlacklistTimer = {days: 0, hours: 6, minutes: 0, seconds: 0};

/** The URL's hostname when it is an http or https URL, otherwise null. */
export function sourceHost(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return /^https?:$/.test(url.protocol) && url.hostname ? url.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * The hostname the backend blocks for a website entry, or null when it has none. Matches
 * normalizeHostname in the backend: bare hosts get a scheme, case and edge dots are dropped.
 */
export function websiteHost(value: string): string | null {
  let trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return null;
  }
  if (!trimmed.includes('://')) {
    trimmed = `https://${trimmed}`;
  }
  try {
    const host = new URL(trimmed).hostname.toLowerCase().replace(/^\.+|\.+$/g, '');
    return host || null;
  } catch {
    return null;
  }
}

export function findBlacklistIssues(sources: string[], sites: string[]): BlacklistIssues {
  const blockedHosts = sites.map(websiteHost).filter((host): host is string => !!host);
  const seenSources = new Set<string>();
  const seenSites = new Set<string>();

  const sourceIssues = sources.map(raw => {
    const value = raw.trim();
    if (!value) {
      return null;
    }
    const host = sourceHost(value);
    let problem: string | null = null;
    if (!host) {
      problem = 'Not an http or https URL';
    } else if (seenSources.has(value)) {
      problem = 'Listed twice';
    } else if (blockedHosts.some(blocked => host === blocked || host.endsWith(`.${blocked}`))) {
      problem = `${host} is on the website blacklist`;
    }
    seenSources.add(value);
    return problem;
  });

  const siteIssues = sites.map(raw => {
    if (!raw.trim()) {
      return null;
    }
    const host = websiteHost(raw);
    let problem: string | null = null;
    if (!host) {
      problem = 'Not a hostname';
    } else if (seenSites.has(host)) {
      problem = 'Listed twice';
    }
    if (host) {
      seenSites.add(host);
    }
    return problem;
  });

  const sourceCount = sourceIssues.filter(Boolean).length;
  const siteCount = siteIssues.filter(Boolean).length;
  return {sources: sourceIssues, sites: siteIssues, sourceCount, siteCount, total: sourceCount + siteCount};
}

function durationLabel(timer: BlacklistTimer): string {
  const parts: Array<[number, string]> = [
    [Number(timer.days) || 0, 'day'],
    [Number(timer.hours) || 0, 'hour'],
    [Number(timer.minutes) || 0, 'minute'],
    [Number(timer.seconds) || 0, 'second'],
  ];
  return parts
    .filter(([value]) => value > 0)
    .map(([value, unit]) => `${value} ${unit}${value === 1 ? '' : 's'}`)
    .join(' ');
}

@Component({
  selector: 'app-admin-blacklist',
  standalone: true,
  imports: [
    HlmButton,
    ReactiveFormsModule,
    VisibleRowsDirective,
    AdminSettingsShellComponent,
    AdminSettingsHeaderComponent,
  ],
  templateUrl: './admin-blacklist.component.html',
  styleUrl: './admin-blacklist.component.scss'
})
export class AdminBlacklistComponent implements OnInit, OnDestroy {
  readonly timerUnits: ReadonlyArray<{control: TimerControl; label: string; short: string; max: number}> = [
    {control: 'days', label: 'Days', short: 'd', max: 30},
    {control: 'hours', label: 'Hours', short: 'h', max: 23},
    {control: 'minutes', label: 'Minutes', short: 'm', max: 59},
    {control: 'seconds', label: 'Seconds', short: 's', max: 59},
  ];

  readonly form: FormGroup;
  readonly newSource: FormControl<string>;
  readonly newSite: FormControl<string>;
  readonly saving = signal(false);
  issues: BlacklistIssues = findBlacklistIssues([], []);

  private loadedSettings?: GlobalSettings;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private changeDetector: ChangeDetectorRef,
    private settingsService: SettingsService,
    private notification: NotificationService
  ) {
    const timerControl = (value: number, max: number) =>
      this.fb.nonNullable.control(value, [Validators.required, Validators.min(0), Validators.max(max)]);

    this.form = this.fb.group({
      blacklist_timer: this.fb.group({
        days: timerControl(DEFAULT_TIMER.days, 30),
        hours: timerControl(DEFAULT_TIMER.hours, 23),
        minutes: timerControl(DEFAULT_TIMER.minutes, 59),
        seconds: timerControl(DEFAULT_TIMER.seconds, 59),
      }),
      blacklist_sources: this.fb.array<FormControl<string>>([]),
      website_blacklist: this.fb.array<FormControl<string>>([]),
    });
    this.newSource = this.fb.nonNullable.control('');
    this.newSite = this.fb.nonNullable.control('');
  }

  ngOnInit(): void {
    this.form.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updateIssues());

    this.settingsService.settings$
      .pipe(
        filter((settings): settings is GlobalSettings => !!settings),
        takeUntil(this.destroy$)
      )
      .subscribe(settings => this.applySettings(settings));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get sources(): FormArray<FormControl<string>> {
    return this.form.get('blacklist_sources') as FormArray<FormControl<string>>;
  }

  get blockedSites(): FormArray<FormControl<string>> {
    return this.form.get('website_blacklist') as FormArray<FormControl<string>>;
  }

  get refreshIntervalSummary(): string {
    const label = durationLabel(this.form.get('blacklist_timer')?.value ?? DEFAULT_TIMER);
    return label
      ? `Every ${label}.`
      : `Not set. Magpie uses the default, every ${durationLabel(DEFAULT_TIMER)}.`;
  }

  get canSave(): boolean {
    return this.form.dirty && this.form.valid && this.issues.total === 0 && !this.saving();
  }

  addSource(): void {
    if (this.addEntry(this.sources, this.newSource)) {
      this.newSource.reset('');
    }
  }

  removeSource(index: number): void {
    this.removeEntry(this.sources, index);
  }

  addBlockedSite(): void {
    if (this.addEntry(this.blockedSites, this.newSite)) {
      this.newSite.reset('');
    }
  }

  removeBlockedSite(index: number): void {
    this.removeEntry(this.blockedSites, index);
  }

  discardChanges(): void {
    if (this.loadedSettings) {
      this.applySettings(this.loadedSettings);
    }
    this.newSource.reset('');
    this.newSite.reset('');
  }

  onSubmit(): void {
    if (!this.canSave) {
      return;
    }

    this.saving.set(true);
    this.settingsService.saveGlobalSettings(this.form.getRawValue())
      .pipe(finalize(() => {
        this.saving.set(false);
        this.changeDetector.markForCheck();
      }))
      .subscribe({
        next: (resp) => {
          // The service has already pushed the saved settings back through settings$.
          this.notification.showSuccess(resp?.message ?? 'Settings saved');
          this.form.markAsPristine();
        },
        error: (err) => {
          console.error('Error saving blacklist settings:', err);
          const reason = err?.error?.message ?? err?.error?.error ?? 'Unknown error';
          this.notification.showError('Failed to save blacklist settings: ' + reason);
        }
      });
  }

  private addEntry(list: FormArray<FormControl<string>>, input: FormControl<string>): boolean {
    const value = input.value.trim();
    if (!value) {
      return false;
    }
    list.push(this.fb.nonNullable.control(value));
    this.form.markAsDirty();
    return true;
  }

  private removeEntry(list: FormArray<FormControl<string>>, index: number): void {
    if (index < 0 || index >= list.length) {
      return;
    }
    list.removeAt(index);
    this.form.markAsDirty();
  }

  private updateIssues(): void {
    this.issues = findBlacklistIssues(this.sources.getRawValue(), this.blockedSites.getRawValue());
    this.changeDetector.markForCheck();
  }

  private applySettings(settings: GlobalSettings): void {
    this.loadedSettings = settings;
    const timer = settings.blacklist_timer ?? DEFAULT_TIMER;
    this.form.get('blacklist_timer')?.setValue({
      days: timer.days ?? 0,
      hours: timer.hours ?? 0,
      minutes: timer.minutes ?? 0,
      seconds: timer.seconds ?? 0,
    }, {emitEvent: false});

    this.resetList(this.sources, settings.blacklist_sources);
    this.resetList(this.blockedSites, settings.website_blacklist);
    this.form.markAsPristine();
    this.updateIssues();
  }

  private resetList(list: FormArray<FormControl<string>>, entries: string[] | undefined): void {
    list.clear({emitEvent: false});
    (entries ?? [])
      .filter(entry => entry.trim().length > 0)
      .forEach(entry => list.push(this.fb.nonNullable.control(entry), {emitEvent: false}));
  }
}
