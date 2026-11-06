import {ChangeDetectorRef, Component, computed, OnDestroy, OnInit, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {HlmInput} from '@spartan-ng/helm/input';
import {HlmSwitch} from '@spartan-ng/helm/switch';
import {Subject, interval} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {AdminSettingsSaveDockComponent} from '../../../shared/admin-settings-shell/admin-settings-save-dock.component';
import {PasswordComponent} from '../../../shared/ui/password.component';
import {RevealGroupDirective} from '../../../shared/reveal-group.directive';
import {SettingsService} from '../../../services/settings.service';
import {HttpService} from '../../../services/http.service';
import {NotificationService} from '../../../services/notification-service.service';
import {IPGeolocationStatus} from '../../../models/GlobalSettings';

@Component({
  selector: 'app-plugin-ipgeolocation', standalone: true,
  imports: [ReactiveFormsModule, RouterLink, HlmInput, HlmSwitch, PasswordComponent,
    AdminSettingsSaveDockComponent, RevealGroupDirective],
  templateUrl: './plugin-ipgeolocation.component.html',
  styleUrls: ['../plugin-abuseipdb/plugin-abuseipdb.component.scss', './plugin-ipgeolocation.component.scss']
})
export class PluginIPGeolocationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  status = signal<IPGeolocationStatus | null>(null);
  quotaUsagePercent = computed(() => {
    const info = this.status();
    if (!info || info.daily_credit_limit <= 0) { return 0; }
    return Math.max(0, Math.min(100, Math.round(info.used_credits / info.daily_credit_limit * 100)));
  });
  creditsRemaining = computed(() => {
    const info = this.status();
    return info ? Math.max(0, info.daily_credit_limit - info.used_credits) : 0;
  });
  statusError = signal('');
  saving = signal(false);
  loaded = signal(false);
  form;

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
      if (settings && !this.form.dirty) {
        this.form.patchValue({enabled: false, api_key: '', include_security: false,
          daily_credit_limit: 300, cache_hours: 168, ...settings.plugins.ipgeolocation});
        this.cdr.markForCheck();
      }
    });
    this.refreshStatus();
    interval(60000).pipe(takeUntil(this.destroy$)).subscribe(() => this.refreshStatus());
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

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

  refreshStatus(): void {
    this.http.getIPGeolocationStatus().pipe(takeUntil(this.destroy$)).subscribe({
      next: status => { this.status.set(status); this.statusError.set(''); },
      error: () => this.statusError.set('Status is unavailable. Check the backend connection and database migrations.')
    });
  }

  timestamp(value?: string | null): string {
    return value ? new Date(value).toLocaleString() : 'Never';
  }
}
