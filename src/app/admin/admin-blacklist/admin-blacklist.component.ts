import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {SettingsService} from '../../services/settings.service';
import {GlobalSettings} from '../../models/GlobalSettings';
import {Subject} from 'rxjs';
import {filter, takeUntil} from 'rxjs/operators';

import {SelectModule} from 'primeng/select';
import {InputTextModule} from 'primeng/inputtext';
import {ButtonModule} from 'primeng/button';
import {NotificationService} from '../../services/notification-service.service';
import {dayOptions, hourOptions, minuteOptions, secondOptions} from '../../shared/duration-options';
import {RevealGroupDirective, RevealStep} from '../../shared/reveal-group.directive';
import {AdminSettingsShellComponent} from '../../shared/admin-settings-shell/admin-settings-shell.component';
import {AdminSettingsHeaderComponent} from '../../shared/admin-settings-shell/admin-settings-header.component';
import {AdminSettingsSaveDockComponent} from '../../shared/admin-settings-shell/admin-settings-save-dock.component';

@Component({
  selector: 'app-admin-blacklist',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    ButtonModule,
    SelectModule,
    RevealGroupDirective,
    AdminSettingsShellComponent,
    AdminSettingsHeaderComponent,
    AdminSettingsSaveDockComponent,
  ],
  templateUrl: './admin-blacklist.component.html',
  styleUrl: './admin-blacklist.component.scss'
})
export class AdminBlacklistComponent implements OnInit, OnDestroy {
  readonly daysList = dayOptions;
  readonly hoursList = hourOptions;
  readonly minutesList = minuteOptions;
  readonly secondsList = secondOptions;
  readonly revealSteps: readonly RevealStep[] = [
    {
      selector: '.admin-context, .settings-card, .save-dock',
      to: {stagger: 0.055},
    },
    {
      selector: '.enforcement-node',
      from: {opacity: 0.15, scale: 0.78, y: 0},
      to: {opacity: 1, scale: 1, y: 0, duration: 0.62, stagger: 0.12, delay: 0.18, ease: 'back.out(1.45)'},
    },
  ];

  form: FormGroup;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private settingsService: SettingsService,
    private notification: NotificationService
  ) {
    this.form = this.fb.group({
      blacklist_timer: this.fb.group({
        days: [0],
        hours: [6],
        minutes: [0],
        seconds: [0]
      }),
      blacklist_sources: this.fb.array([this.createSourceControl()]),
      website_blacklist: this.fb.array([this.createWebsiteControl()])
    });
  }

  ngOnInit(): void {
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

  get blacklistCadenceLabel(): string {
    const timer = this.form.get('blacklist_timer')?.value ?? {};
    const timerParts: Array<[number, string]> = [
      [Number(timer.days ?? 0), 'day'],
      [Number(timer.hours ?? 0), 'hour'],
      [Number(timer.minutes ?? 0), 'minute'],
      [Number(timer.seconds ?? 0), 'second'],
    ];
    const parts = timerParts
      .filter(([value]) => value > 0)
      .map(([value, unit]) => `${value} ${unit}${value === 1 ? '' : 's'}`);

    return parts.length ? parts.join(' ') : 'Continuous';
  }

  get configuredSourceCount(): number {
    return this.sources.controls.filter(control => control.value.trim().length > 0).length;
  }

  get blockedSiteCount(): number {
    return this.blockedSites.controls.filter(control => control.value.trim().length > 0).length;
  }

  addSource(): void {
    this.sources.push(this.createSourceControl());
    this.form.markAsDirty();
  }

  removeSource(index: number): void {
    if (index < 0 || index >= this.sources.length) {
      return;
    }

    if (this.sources.length === 1) {
      this.sources.at(0).setValue('');
    } else {
      this.sources.removeAt(index);
    }
    this.form.markAsDirty();
  }

  addBlockedSite(): void {
    this.blockedSites.push(this.createWebsiteControl());
    this.form.markAsDirty();
  }

  removeBlockedSite(index: number): void {
    if (index < 0 || index >= this.blockedSites.length) {
      return;
    }

    if (this.blockedSites.length === 1) {
      this.blockedSites.at(0).setValue('');
    } else {
      this.blockedSites.removeAt(index);
    }
    this.form.markAsDirty();
  }

  onSubmit(): void {
    this.settingsService.saveGlobalSettings(this.form.getRawValue()).subscribe({
      next: (resp) => {
        this.notification.showSuccess(resp.message ?? 'Settings saved');
        this.form.markAsPristine();
      },
      error: (err) => {
        console.error('Error saving blacklist settings:', err);
        const reason = err?.error?.message ?? err?.error?.error ?? 'Unknown error';
        this.notification.showError('Failed to save blacklist settings: ' + reason);
      }
    });
  }

  private createSourceControl(value: string = ''): FormControl<string> {
    return this.fb.nonNullable.control(value);
  }

  private createWebsiteControl(value: string = ''): FormControl<string> {
    return this.fb.nonNullable.control(value);
  }

  private applySettings(settings: GlobalSettings): void {
    const timer = settings.blacklist_timer ?? { days: 0, hours: 6, minutes: 0, seconds: 0 };
    this.form.patchValue({
      blacklist_timer: {
        days: timer.days ?? 0,
        hours: timer.hours ?? 6,
        minutes: timer.minutes ?? 0,
        seconds: timer.seconds ?? 0
      }
    }, { emitEvent: false });

    this.resetSources(settings.blacklist_sources);
    this.resetWebsiteBlacklist(settings.website_blacklist);
    this.form.markAsPristine();
  }

  private resetSources(sources: string[] = []): void {
    this.sources.clear();

    if (!sources || sources.length === 0) {
      this.sources.push(this.createSourceControl());
    } else {
      sources.forEach(src => this.sources.push(this.createSourceControl(src)));
    }

    this.sources.markAsPristine();
  }

  private resetWebsiteBlacklist(entries: string[] = []): void {
    this.blockedSites.clear();

    if (!entries || entries.length === 0) {
      this.blockedSites.push(this.createWebsiteControl());
    } else {
      entries.forEach(entry => this.blockedSites.push(this.createWebsiteControl(entry)));
    }

    this.blockedSites.markAsPristine();
  }
}
