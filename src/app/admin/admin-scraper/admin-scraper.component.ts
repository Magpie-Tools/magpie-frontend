import {ChangeDetectorRef, Component, OnDestroy, OnInit, signal} from '@angular/core';
import {FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {HlmButton} from '@spartan-ng/helm/button';
import {HlmCheckbox} from '@spartan-ng/helm/checkbox';
import {HlmInput} from '@spartan-ng/helm/input';
import {HlmSwitch} from '@spartan-ng/helm/switch';
import {Subject} from 'rxjs';
import {filter, finalize, takeUntil} from 'rxjs/operators';

import {GlobalSettings} from '../../models/GlobalSettings';
import {NotificationService} from '../../services/notification-service.service';
import {SettingsService} from '../../services/settings.service';
import {formatApproximateDuration} from '../../shared/cadence-format';
import {ConfirmDialogComponent} from '../../shared/ui/confirm-dialog.component';
import {ConfirmationService} from '../../shared/ui/confirmation.service';
import {VisibleRowsDirective} from '../../shared/visible-rows.directive';

export type AdminScraperTab = 'settings' | 'sources';

export interface ScrapeSourceIssues {
  entries: (string | null)[];
  count: number;
}

function sourceHost(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return /^https?:$/.test(url.protocol) && url.hostname ? url.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

function blockedHost(value: string): string | null {
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

export function findScrapeSourceIssues(sources: string[], websiteBlacklist: string[] = []): ScrapeSourceIssues {
  const blockedHosts = websiteBlacklist.map(blockedHost).filter((host): host is string => !!host);
  const seen = new Set<string>();

  const entries = sources.map(raw => {
    const value = raw.trim();
    if (!value) {
      return null;
    }
    const host = sourceHost(value);
    let problem: string | null = null;
    if (!host) {
      problem = 'Not an http or https URL';
    } else if (seen.has(value)) {
      problem = 'Listed twice';
    } else if (blockedHosts.some(blocked => host === blocked || host.endsWith(`.${blocked}`))) {
      problem = `${host} is on the website blacklist`;
    }
    seen.add(value);
    return problem;
  });

  return {entries, count: entries.filter(Boolean).length};
}

@Component({
  selector: 'app-admin-scraper',
  standalone: true,
  imports: [
    HlmButton,
    HlmInput,
    HlmSwitch,
    HlmCheckbox,
    ConfirmDialogComponent,
    ReactiveFormsModule,
    VisibleRowsDirective,
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-scraper.component.html',
  styleUrl: './admin-scraper.component.scss',
})
export class AdminScraperComponent implements OnInit, OnDestroy {
  settingsForm: FormGroup;
  readonly newSource: FormControl<string>;
  activeTab: AdminScraperTab = 'settings';
  readonly saving = signal(false);
  settingsLoaded = false;
  isRequeueingSources = false;
  sourceIssues: ScrapeSourceIssues = {entries: [], count: 0};

  private savedSettings?: GlobalSettings;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private changeDetector: ChangeDetectorRef,
    private settingsService: SettingsService,
    private notification: NotificationService,
    private confirmationService: ConfirmationService,
  ) {
    this.settingsForm = this.createDefaultForm();
    this.newSource = this.fb.nonNullable.control('');
  }

  ngOnInit(): void {
    this.scrapeSites.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateSourceIssues();
    });

    this.settingsService.settings$
      .pipe(
        filter((settings): settings is GlobalSettings => !!settings),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: settings => {
          this.savedSettings = settings;
          if (!this.settingsLoaded || !this.settingsForm.dirty) {
            this.updateFormWithSettings(settings);
          } else {
            this.updateSourceIssues();
          }
          this.settingsLoaded = true;
          this.changeDetector.markForCheck();
        },
        error: err => {
          const reason = err?.error?.message ?? err?.message ?? 'Unknown error';
          this.notification.showError('Could not get scraper settings: ' + reason);
        },
      });

    const dynamicCtrl = this.settingsForm.get('scraper_dynamic_threads')!;
    const unlimitedCtrl = this.settingsForm.get('unlimited_monthly_scrapes')!;
    const proxyLimitCtrl = this.settingsForm.get('proxy_limit_enabled')!;

    dynamicCtrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(isDynamic => {
      this.updateThreadControlState(!!isDynamic);
    });

    unlimitedCtrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(isUnlimited => {
      this.updateMonthlyScrapesState(!!isUnlimited);
    });

    proxyLimitCtrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(enabled => {
      this.updateProxyLimitState(!!enabled);
    });

    this.updateThreadControlState(!!dynamicCtrl.value);
    this.updateMonthlyScrapesState(!!unlimitedCtrl.value);
    this.updateProxyLimitState(!!proxyLimitCtrl.value);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createDefaultForm(): FormGroup {
    return this.fb.group({
      scraper_dynamic_threads: [true],
      scraper_threads: [{value: 250, disabled: true}, [Validators.required, Validators.min(1), Validators.max(10000)]],
      scraper_max_threads: [500, [Validators.required, Validators.min(1), Validators.max(10000)]],
      scraper_retries: [2, [Validators.required, Validators.min(0), Validators.max(100)]],
      scraper_timeout: [7500, [Validators.required, Validators.min(1000), Validators.max(60000)]],
      scraper_respect_robots_txt: [true],
      monthly_scrapes_per_workspace: [3000, [Validators.required, Validators.min(1)]],
      unlimited_monthly_scrapes: [false],
      scrape_sites: this.fb.array<FormControl<string>>([]),
      proxy_limit_enabled: [false],
      proxy_limit_max_per_user: [{value: 0, disabled: true}, [Validators.required, Validators.min(0), Validators.max(1000000)]],
      proxy_limit_exclude_admins: [{value: true, disabled: true}],
    });
  }

  private updateFormWithSettings(settings: GlobalSettings): void {
    this.settingsForm.patchValue(
      {
        scraper_dynamic_threads: settings.scraper.dynamic_threads,
        scraper_threads: settings.scraper.threads,
        scraper_max_threads: settings.scraper.max_threads ?? settings.scraper.threads ?? 500,
        scraper_retries: settings.scraper.retries,
        scraper_timeout: settings.scraper.timeout,
        scraper_respect_robots_txt: settings.scraper.respect_robots_txt ?? true,
        monthly_scrapes_per_workspace: settings.scraper.monthly_scrapes_per_workspace ?? 3000,
        unlimited_monthly_scrapes: settings.scraper.unlimited_monthly_scrapes ?? false,
        proxy_limit_enabled: settings.proxy_limits.enabled,
        proxy_limit_max_per_user: settings.proxy_limits.max_per_user,
        proxy_limit_exclude_admins: settings.proxy_limits.exclude_admins,
      },
      {emitEvent: false},
    );

    this.resetScrapeSites(settings.scraper.scrape_sites);
    this.updateThreadControlState(settings.scraper.dynamic_threads);
    this.updateMonthlyScrapesState(settings.scraper.unlimited_monthly_scrapes ?? false);
    this.updateProxyLimitState(settings.proxy_limits.enabled);
    this.settingsForm.markAsPristine();
    this.updateSourceIssues();
  }

  private updateThreadControlState(isDynamic: boolean): void {
    const threadsCtrl = this.settingsForm.get('scraper_threads');
    const maxThreadsCtrl = this.settingsForm.get('scraper_max_threads');
    if (!threadsCtrl || !maxThreadsCtrl) {
      return;
    }

    if (isDynamic) {
      threadsCtrl.disable({emitEvent: false});
      maxThreadsCtrl.enable({emitEvent: false});
    } else {
      threadsCtrl.enable({emitEvent: false});
      maxThreadsCtrl.disable({emitEvent: false});
    }
  }

  private updateMonthlyScrapesState(isUnlimited: boolean): void {
    const monthlyCtrl = this.settingsForm.get('monthly_scrapes_per_workspace');
    if (!monthlyCtrl) {
      return;
    }

    if (isUnlimited) {
      monthlyCtrl.disable({emitEvent: false});
    } else {
      monthlyCtrl.enable({emitEvent: false});
    }
  }

  private updateProxyLimitState(isEnabled: boolean): void {
    const maxCtrl = this.settingsForm.get('proxy_limit_max_per_user');
    const excludeCtrl = this.settingsForm.get('proxy_limit_exclude_admins');
    if (!maxCtrl || !excludeCtrl) {
      return;
    }

    if (isEnabled) {
      maxCtrl.enable({emitEvent: false});
      excludeCtrl.enable({emitEvent: false});
    } else {
      maxCtrl.disable({emitEvent: false});
      excludeCtrl.disable({emitEvent: false});
    }
  }

  private updateSourceIssues(): void {
    this.sourceIssues = findScrapeSourceIssues(
      this.scrapeSites.getRawValue(),
      this.savedSettings?.website_blacklist ?? [],
    );
    this.changeDetector.markForCheck();
  }

  selectTab(tab: AdminScraperTab): void {
    this.activeTab = tab;
  }

  setDynamicThreads(isDynamic: boolean): void {
    if (this.saving() || !this.settingsLoaded || this.dynamicThreads === isDynamic) {
      return;
    }
    const ctrl = this.settingsForm.get('scraper_dynamic_threads');
    ctrl?.setValue(isDynamic);
    ctrl?.markAsDirty();
  }

  setUnlimitedMonthlyScrapes(isUnlimited: boolean): void {
    if (this.saving() || !this.settingsLoaded || this.unlimitedMonthlyScrapes === isUnlimited) {
      return;
    }
    const ctrl = this.settingsForm.get('unlimited_monthly_scrapes');
    ctrl?.setValue(isUnlimited);
    ctrl?.markAsDirty();
  }

  get dynamicThreads(): boolean {
    return this.settingsForm.get('scraper_dynamic_threads')?.value === true;
  }

  get scrapeSites(): FormArray<FormControl<string>> {
    return this.settingsForm.get('scrape_sites') as FormArray<FormControl<string>>;
  }

  get unlimitedMonthlyScrapes(): boolean {
    return this.settingsForm.get('unlimited_monthly_scrapes')?.value === true;
  }

  get proxyLimitEnabled(): boolean {
    return this.settingsForm.get('proxy_limit_enabled')?.value === true;
  }

  get monthlyScrapesLabel(): string {
    if (this.unlimitedMonthlyScrapes) {
      return 'No limit';
    }
    const value = Number(this.settingsForm.get('monthly_scrapes_per_workspace')?.value ?? 0);
    return Number.isFinite(value) && value > 0 ? `${Math.round(value).toLocaleString()} scrapes` : 'Not set';
  }

  /** Example cadence for ten sources in a 30-day month, at the 15-minute floor. */
  get scraperCadenceExample(): string {
    const value = Number(this.settingsForm.get('monthly_scrapes_per_workspace')?.value ?? 0);
    if (!Number.isFinite(value) || value <= 0) {
      return '';
    }
    const seconds = Math.max(15 * 60, (30 * 24 * 3600 * 10) / value);
    return `Ten sources are scraped about ${formatApproximateDuration(seconds)}.`;
  }

  get scraperThreadLimit(): number {
    const controlName = this.dynamicThreads ? 'scraper_max_threads' : 'scraper_threads';
    const value = Number(this.settingsForm.get(controlName)?.value ?? 0);
    return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  }

  get scraperTotalAttempts(): number {
    const retries = Number(this.settingsForm.get('scraper_retries')?.value ?? 0);
    return Math.max(1, Math.round(Number.isFinite(retries) ? retries : 0) + 1);
  }

  get scraperAttemptWindow(): string {
    const timeout = Number(this.settingsForm.get('scraper_timeout')?.value ?? 0);
    const totalMilliseconds = Math.max(0, Number.isFinite(timeout) ? timeout : 0) * this.scraperTotalAttempts;

    if (totalMilliseconds < 1000) {
      return `${Math.round(totalMilliseconds)} ms`;
    }

    const seconds = totalMilliseconds / 1000;
    return seconds < 60
      ? `${Number(seconds.toFixed(seconds >= 10 ? 0 : 1))} sec`
      : `${Number((seconds / 60).toFixed(1))} min`;
  }

  get threadsInvalid(): boolean {
    const ctrl = this.settingsForm.get(this.dynamicThreads ? 'scraper_max_threads' : 'scraper_threads');
    return !!ctrl?.invalid;
  }

  get timeoutInvalid(): boolean {
    return !!this.settingsForm.get('scraper_timeout')?.invalid;
  }

  get retriesInvalid(): boolean {
    return !!this.settingsForm.get('scraper_retries')?.invalid;
  }

  get monthlyScrapesInvalid(): boolean {
    return !this.unlimitedMonthlyScrapes && !!this.settingsForm.get('monthly_scrapes_per_workspace')?.invalid;
  }

  get proxyLimitMaxInvalid(): boolean {
    return this.proxyLimitEnabled && !!this.settingsForm.get('proxy_limit_max_per_user')?.invalid;
  }

  get hasProblems(): boolean {
    return this.settingsForm.invalid || this.sourceIssues.count > 0;
  }

  get canSave(): boolean {
    return this.settingsForm.dirty && !this.hasProblems && !this.saving() && this.settingsLoaded;
  }

  get validationSummary(): string {
    if (this.threadsInvalid) {
      return 'Concurrency must be between 1 and 10,000 threads';
    }
    if (this.timeoutInvalid) {
      return 'Timeout must be between 1,000 and 60,000 ms';
    }
    if (this.retriesInvalid) {
      return 'Retries must be between 0 and 100';
    }
    if (this.monthlyScrapesInvalid) {
      return 'Monthly scrape allowance must be at least 1';
    }
    if (this.proxyLimitMaxInvalid) {
      return 'Active proxy limit must be between 0 and 1,000,000';
    }
    if (this.sourceIssues.count > 0) {
      const count = this.sourceIssues.count;
      return `${count} ${count === 1 ? 'source needs' : 'sources need'} fixing before you can save`;
    }
    return 'Check the scraper settings before saving';
  }

  get unsavedSummary(): string {
    const dirtySections: string[] = [];
    const engineKeys = [
      'scraper_dynamic_threads',
      'scraper_threads',
      'scraper_max_threads',
      'scraper_timeout',
      'scraper_retries',
      'scraper_respect_robots_txt',
    ];
    const defaultsKeys = [
      'unlimited_monthly_scrapes',
      'monthly_scrapes_per_workspace',
      'proxy_limit_enabled',
      'proxy_limit_max_per_user',
      'proxy_limit_exclude_admins',
    ];

    if (engineKeys.some(key => this.settingsForm.get(key)?.dirty)) {
      dirtySections.push('Scraper engine');
    }
    if (defaultsKeys.some(key => this.settingsForm.get(key)?.dirty)) {
      dirtySections.push('Workspace defaults');
    }
    if (this.scrapeSites.dirty) {
      dirtySections.push('Default sources');
    }

    if (dirtySections.length === 0) {
      return 'Unsaved global scraper changes';
    }
    if (dirtySections.length === 1) {
      return `Unsaved changes to ${dirtySections[0]}`;
    }
    return `Unsaved changes to ${dirtySections.slice(0, -1).join(', ')} and ${dirtySections[dirtySections.length - 1]}`;
  }

  addScrapeSite(): void {
    const value = this.newSource.value.trim();
    if (!value) {
      return;
    }

    this.scrapeSites.push(this.createScrapeSiteControl(value));
    this.newSource.reset('');
    this.scrapeSites.markAsDirty();
    this.settingsForm.markAsDirty();
    this.updateSourceIssues();
  }

  removeScrapeSite(index: number): void {
    if (index < 0 || index >= this.scrapeSites.length) {
      return;
    }

    this.scrapeSites.removeAt(index);
    this.scrapeSites.markAsDirty();
    this.settingsForm.markAsDirty();
    this.updateSourceIssues();
  }

  discardChanges(): void {
    if (this.saving()) {
      return;
    }
    if (this.savedSettings) {
      this.updateFormWithSettings(this.savedSettings);
    }
    this.newSource.reset('');
    this.changeDetector.markForCheck();
  }

  private resetScrapeSites(sites: string[] | null | undefined): void {
    this.scrapeSites.clear({emitEvent: false});
    (sites ?? [])
      .filter(site => site.trim().length > 0)
      .forEach(site => this.scrapeSites.push(this.createScrapeSiteControl(site), {emitEvent: false}));
    this.scrapeSites.markAsPristine();
  }

  private createScrapeSiteControl(value = ''): FormControl<string> {
    return this.fb.nonNullable.control(value);
  }

  onSubmit(): void {
    if (this.saving() || !this.settingsLoaded) {
      return;
    }
    if (this.hasProblems) {
      this.notification.showError(this.validationSummary);
      return;
    }

    this.saving.set(true);
    this.settingsService
      .saveGlobalSettings(this.settingsForm.getRawValue())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.saving.set(false);
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: resp => {
          this.notification.showSuccess(resp.message);
          this.settingsForm.markAsPristine();
          if (this.savedSettings) {
            this.updateFormWithSettings(this.savedSettings);
          }
        },
        error: err => {
          console.error('Error saving settings:', err);
          const reason = err?.error?.message ?? err?.error?.error ?? 'Unknown error';
          this.notification.showError('Failed to save settings: ' + reason);
        },
      });
  }

  confirmRequeueAllScrapeSources(): void {
    if (this.isRequeueingSources || !this.settingsLoaded) {
      return;
    }

    this.confirmationService.confirm({
      message: 'Requeue every currently queued scrape source using the latest scraper cadence?',
      header: 'Confirm Requeue',
      acceptLabel: 'Requeue',
      accept: () => this.requeueAllScrapeSources(),
    });
  }

  private requeueAllScrapeSources(): void {
    this.isRequeueingSources = true;
    this.changeDetector.markForCheck();

    this.settingsService
      .requeueAllScrapeSources()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isRequeueingSources = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: resp => {
          const count = Number(resp?.source_count ?? 0);
          const suffix = Number.isFinite(count) ? ` (${count} sources)` : '';
          this.notification.showSuccess(`${resp?.message ?? 'Queued scrape sources were requeued successfully'}${suffix}`);
        },
        error: err => {
          const reason = err?.error?.message ?? err?.error?.error ?? 'Failed to requeue all scrape sources.';
          this.notification.showError(reason);
        },
      });
  }
}
