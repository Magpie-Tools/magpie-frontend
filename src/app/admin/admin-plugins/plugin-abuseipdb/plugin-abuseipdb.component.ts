import {DecimalPipe, formatDate} from '@angular/common';
import {TIMESTAMP_FORMAT} from '../../../shared/date-formats';
import {HlmButton} from '@spartan-ng/helm/button';
import {HlmInput} from '@spartan-ng/helm/input';
import {HlmSwitch} from '@spartan-ng/helm/switch';
import {PasswordComponent} from '../../../shared/ui/password.component';
import {ChangeDetectorRef, Component, OnDestroy, OnInit, computed, signal, inject, LOCALE_ID} from '@angular/core';
import {RouterLink} from '@angular/router';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Subject, interval} from 'rxjs';
import {filter, startWith, takeUntil} from 'rxjs/operators';

import {GlobalSettings} from '../../../models/GlobalSettings';
import {SettingsService} from '../../../services/settings.service';
import {NotificationService} from '../../../services/notification-service.service';
import {PluginState, hasText, unsavedSummary, usedPercent} from '../plugin-detail';

type AbuseIPDBSettings = GlobalSettings['plugins']['abuseipdb'];

@Component({
  selector: 'app-plugin-abuseipdb',
  standalone: true,
  imports: [DecimalPipe, HlmButton, HlmInput, HlmSwitch, PasswordComponent,
    RouterLink,
    ReactiveFormsModule,
  ],
  templateUrl: './plugin-abuseipdb.component.html',
  styleUrl: '../plugin-detail.scss'
})
export class PluginAbuseIPDBComponent implements OnInit, OnDestroy {
  private readonly locale = inject(LOCALE_ID);
  form: FormGroup;
  saved = signal<AbuseIPDBSettings | null>(null);
  saving = signal(false);

  quotaLimit = computed(() => this.saved()?.daily_limit || null);
  quotaRemaining = computed(() => {
    const saved = this.saved();
    return saved?.daily_limit ? Math.max(0, saved.daily_remaining) : null;
  });
  quotaUsedPercent = computed(() => {
    const limit = this.quotaLimit();
    const remaining = this.quotaRemaining();
    return limit && remaining !== null ? usedPercent(limit - remaining, limit) : 0;
  });
  quotaResetLabel = computed(() => this.formatTimestamp(this.saved()?.daily_reset_at, 'Unknown'));
  lastCheckedLabel = computed(() => this.formatTimestamp(this.saved()?.last_checked_at, 'Never'));
  lastError = computed(() => this.saved()?.last_error?.trim() ?? '');

  state = computed<PluginState>(() => {
    const saved = this.saved();
    if (!saved?.enabled) {
      return {tone: 'off', label: 'Off'};
    }
    if (!saved.api_key?.trim()) {
      return {tone: 'bad', label: 'Needs an API key'};
    }
    if (this.lastError()) {
      return {tone: 'bad', label: 'Last check failed'};
    }
    return {tone: 'good', label: 'Running'};
  });

  private readonly changeLabels = {
    enabled: 'enabled',
    api_key: 'API key',
    max_age_in_days: 'report max age'
  };
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private settingsService: SettingsService,
    private notification: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      enabled: [false],
      api_key: [''],
      max_age_in_days: [30, [Validators.required, Validators.min(1), Validators.max(365)]]
    });
  }

  ngOnInit(): void {
    this.settingsService.settings$
      .pipe(
        filter((settings): settings is GlobalSettings => !!settings),
        takeUntil(this.destroy$)
      )
      .subscribe(settings => this.applySettings(settings.plugins.abuseipdb));

    interval(60 * 60 * 1000)
      .pipe(startWith(0), takeUntil(this.destroy$))
      .subscribe(() => {
        this.settingsService.refreshGlobalSettings().subscribe({ error: () => {} });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get enabled(): boolean {
    return !!this.form.get('enabled')?.value;
  }

  get missingKey(): boolean {
    return this.enabled && !hasText(this.form.get('api_key'));
  }

  get unsavedSummary(): string {
    return unsavedSummary(this.form, this.changeLabels);
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }

    const raw = this.form.getRawValue();
    const payload = {
      plugins: {
        abuseipdb: {
          enabled: !!raw.enabled,
          api_key: typeof raw.api_key === 'string' ? raw.api_key.trim() : '',
          max_age_in_days: raw.max_age_in_days ?? 30
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
        console.error('Error saving AbuseIPDB settings:', err);
        this.notification.showError('Failed to save AbuseIPDB settings: ' + (err?.error?.message ?? 'Unknown error'));
      }
    });
  }

  discardChanges(): void {
    const saved = this.saved();
    if (saved) {
      this.patchForm(saved);
    }
  }

  private applySettings(abuseipdb: AbuseIPDBSettings | undefined): void {
    if (!abuseipdb) {
      return;
    }
    this.saved.set(abuseipdb);
    if (!this.form.dirty) {
      this.patchForm(abuseipdb);
    }
  }

  private patchForm(abuseipdb: AbuseIPDBSettings): void {
    this.form.reset({
      enabled: abuseipdb.enabled ?? false,
      api_key: abuseipdb.api_key ?? '',
      max_age_in_days: abuseipdb.max_age_in_days ?? 30
    }, { emitEvent: false });
    this.cdr.markForCheck();
  }

  private formatTimestamp(timestamp: string | null | undefined, fallback: string): string {
    if (!timestamp) {
      return fallback;
    }

    const parsed = new Date(timestamp);
    if (isNaN(parsed.getTime())) {
      return timestamp;
    }

    return formatDate(parsed, TIMESTAMP_FORMAT, this.locale);
  }
}
