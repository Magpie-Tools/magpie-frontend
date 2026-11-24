import {formatDate} from '@angular/common';
import {TIMESTAMP_FORMAT} from '../../../shared/date-formats';
import {HlmButton} from '@spartan-ng/helm/button';
import {HlmInput} from '@spartan-ng/helm/input';
import {HlmSwitch} from '@spartan-ng/helm/switch';
import {PasswordComponent} from '../../../shared/ui/password.component';
import {ChangeDetectorRef, Component, OnDestroy, OnInit, computed, signal, inject, LOCALE_ID} from '@angular/core';
import {RouterLink} from '@angular/router';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Subject} from 'rxjs';
import {filter, takeUntil} from 'rxjs/operators';

import {GlobalSettings} from '../../../models/GlobalSettings';
import {SettingsService} from '../../../services/settings.service';
import {NotificationService} from '../../../services/notification-service.service';
import {PluginState, hasText, unsavedSummary} from '../plugin-detail';

type GeoliteSettings = GlobalSettings['plugins']['geolite'];
type UpdateTimer = GeoliteSettings['update_timer'];

const DAY_MS = 24 * 60 * 60 * 1000;
/** A database older than this counts as out of date, unless the update interval is longer. */
const STALE_AFTER_MS = 7 * DAY_MS;

export interface IntervalField {
  control: keyof UpdateTimer;
  id: string;
  label: string;
  unit: string;
  max: number;
}

@Component({
  selector: 'app-plugin-geolite',
  standalone: true,
  imports: [HlmButton, HlmInput, HlmSwitch, PasswordComponent,
    RouterLink,
    ReactiveFormsModule,
  ],
  templateUrl: './plugin-geolite.component.html',
  styleUrl: '../plugin-detail.scss'
})
export class PluginGeoliteComponent implements OnInit, OnDestroy {
  private readonly locale = inject(LOCALE_ID);
  readonly intervalFields: IntervalField[] = [
    {control: 'days', id: 'geolite-days', label: 'Days', unit: 'days', max: 30},
    {control: 'hours', id: 'geolite-hours', label: 'Hours', unit: 'hours', max: 23},
    {control: 'minutes', id: 'geolite-minutes', label: 'Minutes', unit: 'min', max: 59},
    {control: 'seconds', id: 'geolite-seconds', label: 'Seconds', unit: 'sec', max: 59}
  ];
  form: FormGroup;
  saved = signal<GeoliteSettings | null>(null);
  saving = signal(false);

  lastUpdatedLabel = computed(() => this.formatTimestamp(this.saved()?.last_updated_at));

  /** Days since the last download when the database is out of date, otherwise null. */
  staleDays = computed<number | null>(() => {
    const saved = this.saved();
    const last = this.parse(saved?.last_updated_at);
    if (!saved?.enabled || !saved.api_key?.trim() || !last) {
      return null;
    }
    const age = Date.now() - last.getTime();
    const limit = saved.auto_update
      ? Math.max(STALE_AFTER_MS, intervalMs(saved.update_timer) + DAY_MS)
      : STALE_AFTER_MS;
    return age > limit ? Math.floor(age / DAY_MS) : null;
  });

  nextUpdateLabel = computed(() => {
    const saved = this.saved();
    if (!saved?.enabled) {
      return 'Paused';
    }
    if (!saved.api_key?.trim()) {
      return 'Waiting for a license key';
    }
    if (!saved.auto_update) {
      return 'Not scheduled';
    }
    const last = this.parse(saved.last_updated_at);
    if (!last) {
      return 'Pending';
    }
    const next = new Date(last.getTime() + intervalMs(saved.update_timer));
    return next.getTime() <= Date.now() ? 'Due now' : formatDate(next, TIMESTAMP_FORMAT, this.locale);
  });

  intervalLabel = computed(() => {
    const saved = this.saved();
    return saved?.auto_update ? cadenceLabel(saved.update_timer) : 'Off';
  });

  state = computed<PluginState>(() => {
    const saved = this.saved();
    if (!saved?.enabled) {
      return {tone: 'off', label: 'Off'};
    }
    if (!saved.api_key?.trim()) {
      return {tone: 'bad', label: 'Needs a license key'};
    }
    if (this.staleDays() !== null) {
      return {tone: 'bad', label: 'Database out of date'};
    }
    return {tone: 'good', label: 'Running'};
  });

  private readonly changeLabels = {
    enabled: 'enabled',
    api_key: 'license key',
    auto_update: 'automatic updates',
    'update_timer.days': 'update interval',
    'update_timer.hours': 'update interval',
    'update_timer.minutes': 'update interval',
    'update_timer.seconds': 'update interval'
  };
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private settingsService: SettingsService,
    private notification: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    const part = (max: number) => [0, [Validators.required, Validators.min(0), Validators.max(max), Validators.pattern(/^\d+$/)]];
    this.form = this.fb.group({
      enabled: [false],
      api_key: [''],
      auto_update: [false],
      update_timer: this.fb.group({
        days: part(30),
        hours: part(23),
        minutes: part(59),
        seconds: part(59)
      }),
      last_updated_at: [null]
    });
  }

  ngOnInit(): void {
    this.settingsService.settings$
      .pipe(
        filter((settings): settings is GlobalSettings => !!settings),
        takeUntil(this.destroy$)
      )
      .subscribe(settings => this.applySettings(settings.plugins.geolite));

    this.form.get('auto_update')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.syncTimerState());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get enabled(): boolean {
    return !!this.form.get('enabled')?.value;
  }

  get autoUpdate(): boolean {
    return !!this.form.get('auto_update')?.value;
  }

  get missingKey(): boolean {
    return this.enabled && !hasText(this.form.get('api_key'));
  }

  get timerInvalid(): boolean {
    return !!this.form.get('update_timer')?.invalid;
  }

  get unsavedSummary(): string {
    return unsavedSummary(this.form, this.changeLabels);
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }

    const raw = this.form.getRawValue();
    const timer = raw.update_timer ?? {};
    const payload = {
      plugins: {
        geolite: {
          enabled: !!raw.enabled,
          api_key: typeof raw.api_key === 'string' ? raw.api_key.trim() : '',
          auto_update: !!raw.auto_update,
          update_timer: {
            days: Number(timer.days ?? 1),
            hours: Number(timer.hours ?? 0),
            minutes: Number(timer.minutes ?? 0),
            seconds: Number(timer.seconds ?? 0)
          },
          last_updated_at: raw.last_updated_at ?? null
        }
      }
    };

    this.saving.set(true);
    this.settingsService.saveGlobalSettings(payload).subscribe({
      next: (resp) => {
        this.saving.set(false);
        this.notification.showSuccess(resp.message ?? 'Settings saved');
        this.form.markAsPristine();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving.set(false);
        console.error('Error saving GeoLite settings:', err);
        this.notification.showError('Failed to save GeoLite settings: ' + (err?.error?.message ?? 'Unknown error'));
      }
    });
  }

  discardChanges(): void {
    const saved = this.saved();
    if (saved) {
      this.patchForm(saved);
    }
  }

  private applySettings(geolite: GeoliteSettings | undefined): void {
    if (!geolite) {
      return;
    }
    this.saved.set(geolite);
    if (!this.form.dirty) {
      this.patchForm(geolite);
    }
  }

  private patchForm(geolite: GeoliteSettings): void {
    this.form.reset({
      enabled: geolite.enabled ?? false,
      api_key: geolite.api_key ?? '',
      auto_update: geolite.auto_update ?? false,
      update_timer: {
        days: geolite.update_timer?.days ?? 1,
        hours: geolite.update_timer?.hours ?? 0,
        minutes: geolite.update_timer?.minutes ?? 0,
        seconds: geolite.update_timer?.seconds ?? 0
      },
      last_updated_at: geolite.last_updated_at ?? null
    }, { emitEvent: false });
    this.syncTimerState();
  }

  // The interval only matters while automatic updates are on, so it is locked otherwise.
  private syncTimerState(): void {
    const group = this.form.get('update_timer');
    if (this.autoUpdate) {
      group?.enable({ emitEvent: false });
    } else {
      group?.disable({ emitEvent: false });
    }
    this.cdr.markForCheck();
  }

  private parse(timestamp?: string | null): Date | null {
    if (!timestamp) {
      return null;
    }
    const parsed = new Date(timestamp);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private formatTimestamp(timestamp?: string | null): string {
    if (!timestamp) {
      return 'Never';
    }
    const parsed = this.parse(timestamp);
    return parsed ? formatDate(parsed, TIMESTAMP_FORMAT, this.locale) : timestamp;
  }
}

function intervalMs(timer: UpdateTimer | undefined): number {
  if (!timer) {
    return 0;
  }
  return (((Number(timer.days) || 0) * 24 + (Number(timer.hours) || 0)) * 60 + (Number(timer.minutes) || 0)) * 60_000
    + (Number(timer.seconds) || 0) * 1000;
}

/** "Every day", "Every 2 days", "Every 1 day 6 hours". */
export function cadenceLabel(timer: UpdateTimer | undefined): string {
  const parts: Array<[number, string]> = [
    [Number(timer?.days ?? 0), 'day'],
    [Number(timer?.hours ?? 0), 'hour'],
    [Number(timer?.minutes ?? 0), 'minute'],
    [Number(timer?.seconds ?? 0), 'second']
  ];
  const set = parts.filter(([value]) => value > 0);
  if (!set.length) {
    return 'Continuous';
  }
  if (set.length === 1 && set[0][0] === 1) {
    return `Every ${set[0][1]}`;
  }
  return 'Every ' + set.map(([value, unit]) => `${value} ${unit}${value === 1 ? '' : 's'}`).join(' ');
}
