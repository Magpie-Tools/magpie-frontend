import {DecimalPipe, formatDate} from '@angular/common';
import {TIMESTAMP_FORMAT} from '../../../shared/date-formats';
import {ChangeDetectorRef, Component, computed, OnDestroy, OnInit, signal, inject, LOCALE_ID} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {HlmButton} from '@spartan-ng/helm/button';
import {HlmInput} from '@spartan-ng/helm/input';
import {HlmSwitch} from '@spartan-ng/helm/switch';
import {Subject, interval} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {PasswordComponent} from '../../../shared/ui/password.component';
import {SettingsService} from '../../../services/settings.service';
import {HttpService} from '../../../services/http.service';
import {NotificationService} from '../../../services/notification-service.service';
import {IPGeolocationPluginSettings, IPGeolocationStatus} from '../../../models/GlobalSettings';
import {PluginState, unsavedSummary, usedPercent} from '../plugin-detail';

const DEFAULTS: IPGeolocationPluginSettings = {
  enabled: false, api_key: '', include_security: false, daily_credit_limit: 300, cache_hours: 168
};

@Component({
  selector: 'app-plugin-ipgeolocation', standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink, HlmButton, HlmInput, HlmSwitch, PasswordComponent],
  templateUrl: './plugin-ipgeolocation.component.html',
  styleUrl: '../plugin-detail.scss'
})
export class PluginIPGeolocationComponent implements OnInit, OnDestroy {
  private readonly locale = inject(LOCALE_ID);
  private destroy$ = new Subject<void>();
  status = signal<IPGeolocationStatus | null>(null);
  saved = signal<IPGeolocationPluginSettings | null>(null);
  quotaUsagePercent = computed(() => {
    const info = this.status();
    return info ? usedPercent(info.used_credits, info.daily_credit_limit) : 0;
  });
  creditsRemaining = computed(() => {
    const info = this.status();
    return info ? Math.max(0, info.daily_credit_limit - info.used_credits) : 0;
  });
  state = computed<PluginState>(() => {
    const saved = this.saved();
    if (!saved?.enabled) {
      return {tone: 'off', label: 'Off'};
    }
    if (!saved.api_key?.trim()) {
      return {tone: 'bad', label: 'Needs an API key'};
    }
    if (this.status()?.last_error) {
      return {tone: 'bad', label: 'Last lookup failed'};
    }
    return {tone: 'good', label: 'Running'};
  });
  statusError = signal('');
  saving = signal(false);
  loaded = signal(false);
  form;

  private readonly changeLabels = {
    enabled: 'enabled',
    api_key: 'API key',
    include_security: 'security signals',
    daily_credit_limit: 'daily credit budget',
    cache_hours: 'cache duration'
  };

  constructor(private fb: FormBuilder, private settings: SettingsService, private http: HttpService,
              private notification: NotificationService, private cdr: ChangeDetectorRef) {
    this.form = this.fb.nonNullable.group({
      enabled: false, api_key: '', include_security: false,
      daily_credit_limit: [300, [Validators.required, Validators.min(1), Validators.max(100000), Validators.pattern(/^\d+$/)]],
      cache_hours: [168, [Validators.required, Validators.min(1), Validators.max(720), Validators.pattern(/^\d+$/)]]
    });
  }

  ngOnInit(): void {
    this.settings.settings$.pipe(takeUntil(this.destroy$)).subscribe(settings => {
      this.loaded.set(!!settings);
      if (!settings) { return; }
      const saved = {...DEFAULTS, ...settings.plugins.ipgeolocation};
      this.saved.set(saved);
      if (!this.form.dirty) { this.patchForm(saved); }
    });
    this.refreshStatus();
    interval(60000).pipe(takeUntil(this.destroy$)).subscribe(() => this.refreshStatus());
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  get missingKey(): boolean {
    const value = this.form.getRawValue();
    return value.enabled && !value.api_key.trim();
  }

  /** Why the form cannot be saved, in the words the save dock shows. Empty when it can. */
  get blockedReason(): string {
    if (!this.loaded()) { return ''; }
    if (this.missingKey) { return 'Add an API key or turn the plugin off to save.'; }
    const value = this.form.getRawValue();
    if (this.form.invalid) { return 'Enter whole numbers within the allowed ranges.'; }
    if (value.include_security && value.daily_credit_limit < 3) {
      return 'Security signals need a budget of at least 3 credits.';
    }
    return '';
  }

  get unsavedSummary(): string {
    return unsavedSummary(this.form, this.changeLabels);
  }

  invalid(): boolean {
    const value = this.form.getRawValue();
    return !this.loaded() || this.form.invalid || value.enabled && !value.api_key.trim()
      || value.include_security && value.daily_credit_limit < 3;
  }

  onSubmit(): void {
    if (this.invalid() || this.saving()) { return; }
    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.settings.saveGlobalSettings({plugins: {ipgeolocation: {...raw, api_key: raw.api_key.trim()}}})
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.form.markAsPristine(); this.saving.set(false);
          this.notification.showSuccess('IPGeolocation.io settings saved');
          this.refreshStatus(); this.cdr.markForCheck();
        },
        error: err => {
          this.saving.set(false);
          this.notification.showError(err?.error?.error ?? 'Could not save IPGeolocation.io settings');
        }
      });
  }

  discardChanges(): void {
    const saved = this.saved();
    if (saved) { this.patchForm(saved); }
  }

  refreshStatus(): void {
    this.http.getIPGeolocationStatus().pipe(takeUntil(this.destroy$)).subscribe({
      next: status => { this.status.set(status); this.statusError.set(''); },
      error: () => this.statusError.set('Status is unavailable. Check the backend connection and database migrations.')
    });
  }

  timestamp(value?: string | null): string {
    return value ? formatDate(value, TIMESTAMP_FORMAT, this.locale) : 'Never';
  }

  private patchForm(saved: IPGeolocationPluginSettings): void {
    this.form.reset(saved, {emitEvent: false});
    this.cdr.markForCheck();
  }
}
