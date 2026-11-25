import {ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, signal} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {HlmButton} from '@spartan-ng/helm/button';
import {HlmInput} from '@spartan-ng/helm/input';
import {HlmSwitch} from '@spartan-ng/helm/switch';
import {HlmTabsImports} from '@spartan-ng/helm/tabs';
import {Subject} from 'rxjs';
import {finalize, take, takeUntil} from 'rxjs/operators';

import {
  JudgeCheckMode,
  judgeRegexValidator,
  judgeUrlValidator,
} from '../../checker/judges/judge-validation';
import {NotificationService} from '../../services/notification-service.service';
import {SettingsService} from '../../services/settings.service';
import {AdminSettingsHeaderComponent} from '../../shared/admin-settings-shell/admin-settings-header.component';
import {AdminSettingsShellComponent} from '../../shared/admin-settings-shell/admin-settings-shell.component';
import {formatApproximateDuration} from '../../shared/cadence-format';
import {ConfirmDialogComponent} from '../../shared/ui/confirm-dialog.component';
import {ConfirmationService} from '../../shared/ui/confirmation.service';
import {SelectComponent} from '../../shared/ui/select.component';

@Component({
  selector: 'app-admin-checker',
  standalone: true,
  imports: [
    HlmButton,
    HlmInput,
    HlmSwitch,
    HlmTabsImports,
    SelectComponent,
    ConfirmDialogComponent,
    ReactiveFormsModule,
    AdminSettingsShellComponent,
    AdminSettingsHeaderComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-checker.component.html',
  styleUrl: './admin-checker.component.scss',
})
export class AdminCheckerComponent implements OnInit, OnDestroy {
  settingsForm: FormGroup;
  readonly protocolOptions = [
    {label: 'HTTP', control: 'http'},
    {label: 'HTTPS', control: 'https'},
    {label: 'SOCKS4', control: 'socks4'},
    {label: 'SOCKS5', control: 'socks5'},
  ];
  readonly timerUnits = [
    {control: 'days', label: 'Days', short: 'd', max: 30},
    {control: 'hours', label: 'Hours', short: 'h', max: 23},
    {control: 'minutes', label: 'Minutes', short: 'm', max: 59},
    {control: 'seconds', label: 'Seconds', short: 's', max: 59},
  ];
  readonly judgeCheckModes: {label: string; value: JudgeCheckMode}[] = [
    {label: 'Header check', value: 'default'},
    {label: 'Regex', value: 'regex'},
  ];

  readonly openJudgeIndex = signal(-1);
  readonly saving = signal(false);
  isRequeueing = false;

  private lastCheckerSettings: any = null;
  private lastProtocols: any = null;
  private lastBlacklist: string[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private changeDetector: ChangeDetectorRef,
    private settingsService: SettingsService,
    private notification: NotificationService,
    private confirmationService: ConfirmationService,
    private host: ElementRef<HTMLElement>,
  ) {
    this.settingsForm = this.createDefaultForm();
  }

  ngOnInit(): void {
    this.settingsService.getCheckerSettings().pipe(take(1)).subscribe({
      next: checkerSettings => {
        if (checkerSettings) {
          this.lastCheckerSettings = checkerSettings;
          this.updateFormWithCheckerSettings(checkerSettings);
        }
      },
      error: err => {
        this.notification.showError('Could not get checker settings: ' + (err?.error?.message ?? 'Unknown error'));
      },
    });

    const settings = this.settingsService.getGlobalSettings();
    if (settings) {
      this.lastProtocols = settings.protocols;
      this.lastBlacklist = settings.blacklist_sources ?? [];
      this.updateProtocolsAndBlacklist(settings.protocols, settings.blacklist_sources);
    }

    this.settingsService.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe(settingsState => {
        if (!settingsState) {
          return;
        }
        this.lastProtocols = settingsState.protocols;
        this.lastBlacklist = settingsState.blacklist_sources ?? [];
        if (settingsState.checker) {
          this.lastCheckerSettings = settingsState.checker;
        }
        if (!this.settingsForm.dirty) {
          this.updateProtocolsAndBlacklist(settingsState.protocols, settingsState.blacklist_sources);
        }
      });

    const dynamicControl = this.settingsForm.get('dynamic_threads');
    this.updateThreadControlState(!!dynamicControl?.value);
    dynamicControl?.valueChanges
      ?.pipe(takeUntil(this.destroy$))
      .subscribe({
        next: dynamic => this.updateThreadControlState(!!dynamic),
        error: err => this.notification.showError('Could not get dynamic thread info ' + (err?.error?.message ?? '')),
      });

    const unlimitedControl = this.settingsForm.get('unlimited_monthly_checks');
    this.updateMonthlyAllowanceControlState(!!unlimitedControl?.value);
    unlimitedControl?.valueChanges
      ?.pipe(takeUntil(this.destroy$))
      .subscribe(unlimited => this.updateMonthlyAllowanceControlState(!!unlimited));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createDefaultForm(): FormGroup {
    return this.fb.group({
      dynamic_threads: [false],
      threads: [250, [Validators.required, Validators.min(1)]],
      max_threads: [250, [Validators.required, Validators.min(1)]],
      save_responses: [true],
      retries: [2, [Validators.required, Validators.min(0)]],
      timeout: [7500, [Validators.required, Validators.min(1)]],
      protocols: this.fb.group({
        http: [false],
        https: [true],
        socks4: [false],
        socks5: [false],
      }),
      monthly_checks_per_workspace: [1500000, [Validators.required, Validators.min(1)]],
      unlimited_monthly_checks: [false],
      judges_threads: [3, [Validators.required, Validators.min(1)]],
      judges_timeout: [5000, [Validators.required, Validators.min(1)]],
      judge_timer: this.fb.group({
        days: [0, [Validators.min(0), Validators.max(30)]],
        hours: [0, [Validators.min(0), Validators.max(23)]],
        minutes: [30, [Validators.min(0), Validators.max(59)]],
        seconds: [0, [Validators.min(0), Validators.max(59)]],
      }),
      judges: this.fb.array([
        this.createJudgeGroup('https://pool.proxyspace.pro/judge.php', 'default'),
        this.createJudgeGroup('http://azenv.net', 'default'),
      ]),
      use_https_for_socks: [true],
      iplookup: ['https://ident.me', [Validators.required]],
      standard_header: this.fb.array([
        'USER-AGENT', 'HOST', 'ACCEPT', 'ACCEPT-ENCODING',
      ]),
      proxy_header: this.fb.array([
        'HTTP_X_FORWARDED_FOR', 'HTTP_FORWARDED', 'HTTP_VIA', 'HTTP_X_PROXY_ID',
      ]),
      blacklisted: this.fb.array([]),
    });
  }

  private createJudgeGroup(url: string = '', regex: string = 'default'): FormGroup {
    const usesHeaders = !regex || regex.trim().toLowerCase() === 'default';
    return this.fb.group(
      {
        url: [url, judgeUrlValidator],
        mode: [usesHeaders ? 'default' : 'regex'],
        regex: [usesHeaders ? '' : regex],
      },
      {validators: judgeRegexValidator},
    );
  }

  private updateFormWithCheckerSettings(checkerSettings: any): void {
    this.settingsForm.patchValue({
      dynamic_threads: !!checkerSettings.dynamic_threads,
      threads: checkerSettings.threads ?? 250,
      max_threads: checkerSettings.max_threads ?? checkerSettings.threads ?? 250,
      save_responses: checkerSettings.save_responses ?? true,
      retries: checkerSettings.retries ?? 2,
      timeout: checkerSettings.timeout ?? 7500,
      monthly_checks_per_workspace: checkerSettings.monthly_checks_per_workspace ?? 1500000,
      unlimited_monthly_checks: !!checkerSettings.unlimited_monthly_checks,
      iplookup: checkerSettings.ip_lookup ?? '',
      judges_threads: checkerSettings.judges_threads ?? 3,
      judges_timeout: checkerSettings.judges_timeout ?? 5000,
      use_https_for_socks: checkerSettings.use_https_for_socks ?? true,
    });

    if (checkerSettings.judge_timer) {
      this.settingsForm.patchValue({
        judge_timer: {
          days: checkerSettings.judge_timer.days ?? 0,
          hours: checkerSettings.judge_timer.hours ?? 0,
          minutes: checkerSettings.judge_timer.minutes ?? 0,
          seconds: checkerSettings.judge_timer.seconds ?? 0,
        },
      });
    }

    this.updateJudgesArray(checkerSettings.judges);
    this.updateHeadersArrays(
      checkerSettings.standard_header || ['USER-AGENT', 'HOST', 'ACCEPT', 'ACCEPT-ENCODING'],
      checkerSettings.proxy_header || ['HTTP_X_FORWARDED_FOR', 'HTTP_FORWARDED', 'HTTP_VIA', 'HTTP_X_PROXY_ID'],
    );
    this.updateThreadControlState(!!checkerSettings.dynamic_threads);
    this.updateMonthlyAllowanceControlState(!!checkerSettings.unlimited_monthly_checks);
    this.openJudgeIndex.set(-1);
    this.settingsForm.markAsPristine();
    this.changeDetector.markForCheck();
  }

  private updateProtocolsAndBlacklist(protocols: any, blacklist: string[]): void {
    if (protocols && typeof protocols === 'object') {
      const protocolsGroup = this.settingsForm.get('protocols') as FormGroup;
      Object.keys(protocols).forEach(protocol => {
        if (protocolsGroup.contains(protocol)) {
          protocolsGroup.get(protocol)?.setValue(!!protocols[protocol], {emitEvent: false});
        }
      });
      protocolsGroup.markAsPristine();
    }

    const blacklistArray = this.settingsForm.get('blacklisted') as FormArray;
    blacklistArray.clear();
    (blacklist ?? []).forEach(url => {
      blacklistArray.push(this.fb.control(url));
    });
    blacklistArray.markAsPristine();
    this.changeDetector.markForCheck();
  }

  private updateJudgesArray(judges: any[]): void {
    if (!Array.isArray(judges)) {
      return;
    }

    const judgesArray = this.settingsForm.get('judges') as FormArray;
    judgesArray.clear();
    judges.forEach(judge => {
      judgesArray.push(this.createJudgeGroup(judge.url ?? '', judge.regex ?? 'default'));
    });
  }

  private updateHeadersArrays(standardHeaders: string[], proxyHeaders: string[]): void {
    const standardHeaderArray = this.settingsForm.get('standard_header') as FormArray;
    standardHeaderArray.clear();
    standardHeaders.forEach(header => {
      standardHeaderArray.push(this.fb.control(header));
    });

    const proxyHeaderArray = this.settingsForm.get('proxy_header') as FormArray;
    proxyHeaderArray.clear();
    proxyHeaders.forEach(header => {
      proxyHeaderArray.push(this.fb.control(header));
    });
  }

  private updateThreadControlState(dynamic: boolean): void {
    const threadsControl = this.settingsForm.get('threads');
    const maxThreadsControl = this.settingsForm.get('max_threads');

    if (dynamic) {
      threadsControl?.disable({emitEvent: false});
      maxThreadsControl?.enable({emitEvent: false});
      return;
    }

    threadsControl?.enable({emitEvent: false});
    maxThreadsControl?.disable({emitEvent: false});
  }

  private updateMonthlyAllowanceControlState(unlimited: boolean): void {
    const control = this.settingsForm.get('monthly_checks_per_workspace');
    if (unlimited) {
      control?.disable({emitEvent: false});
      return;
    }
    control?.enable({emitEvent: false});
  }

  get judges(): FormArray<FormGroup> {
    return this.settingsForm.get('judges') as FormArray<FormGroup>;
  }

  get judgeControls(): FormGroup[] {
    return this.judges.controls as FormGroup[];
  }

  get dynamicThreads(): boolean {
    return this.settingsForm.get('dynamic_threads')?.value === true;
  }

  get unlimitedMonthlyChecks(): boolean {
    return this.settingsForm.get('unlimited_monthly_checks')?.value === true;
  }

  get monthlyChecksLabel(): string {
    if (this.unlimitedMonthlyChecks) {
      return 'No limit';
    }
    const value = Number(this.settingsForm.get('monthly_checks_per_workspace')?.value ?? 0);
    return Number.isFinite(value) && value > 0 ? `${Math.round(value).toLocaleString()} checks` : 'Not set';
  }

  /** Example cadence for 1,000 proxies on one protocol in a 30-day month. */
  get checkerCadenceExample(): string {
    const value = Number(this.settingsForm.get('monthly_checks_per_workspace')?.value ?? 0);
    if (!Number.isFinite(value) || value <= 0) {
      return '';
    }
    const seconds = Math.max(60, (30 * 24 * 3600 * 1000) / value);
    return `For example, 1,000 proxies on one protocol are checked about ${formatApproximateDuration(seconds)}.`;
  }

  get judgeCadenceLabel(): string {
    return this.formatTimer('judge_timer');
  }

  get totalAttempts(): number {
    const retries = Number(this.settingsForm.get('retries')?.value ?? 0);
    return Math.max(1, Math.round(Number.isFinite(retries) ? retries : 0) + 1);
  }

  get checkerAttemptWindow(): string {
    const timeout = Number(this.settingsForm.get('timeout')?.value ?? 0);
    const totalMilliseconds = Math.max(0, Number.isFinite(timeout) ? timeout : 0) * this.totalAttempts;

    if (totalMilliseconds < 1000) {
      return `${Math.round(totalMilliseconds)} ms`;
    }

    const seconds = totalMilliseconds / 1000;
    return seconds < 60
      ? `${Number(seconds.toFixed(seconds >= 10 ? 0 : 1))} sec`
      : `${Number((seconds / 60).toFixed(1))} min`;
  }

  get threadLimit(): number {
    const controlName = this.dynamicThreads ? 'max_threads' : 'threads';
    const value = Number(this.settingsForm.get(controlName)?.value ?? 0);
    return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  }

  get judgeProblemCount(): number {
    return this.judgeControls.filter(judge => judge.invalid).length;
  }

  setDynamicThreads(dynamic: boolean): void {
    const control = this.settingsForm.get('dynamic_threads');
    if (!control || control.value === dynamic) {
      return;
    }
    control.setValue(dynamic);
    control.markAsDirty();
  }

  setLimitedMonthlyChecks(limited: boolean): void {
    const control = this.settingsForm.get('unlimited_monthly_checks');
    const unlimited = !limited;
    if (!control || control.value === unlimited) {
      return;
    }
    control.setValue(unlimited);
    control.markAsDirty();
  }

  toggleProtocol(controlName: string): void {
    const control = this.settingsForm.get(`protocols.${controlName}`);
    if (!control) {
      return;
    }

    control.setValue(!control.value);
    control.markAsDirty();
  }

  judgeUrl(judge: FormGroup): string {
    return String(judge.get('url')?.value ?? '').trim();
  }

  judgeHostname(judge: FormGroup): string {
    const url = this.judgeUrl(judge);
    try {
      return new URL(url).host || url;
    } catch {
      return url || 'New judge';
    }
  }

  judgePath(judge: FormGroup): string {
    try {
      const parsed = new URL(this.judgeUrl(judge));
      return (parsed.pathname === '/' ? '' : parsed.pathname) + parsed.search;
    } catch {
      return '';
    }
  }

  usesRegex(judge: FormGroup): boolean {
    return judge.get('mode')?.value === 'regex';
  }

  judgeUrlError(judge: FormGroup): string | null {
    const control = judge.get('url');
    if (!control?.value && !control?.dirty && !control?.touched) {
      return null;
    }
    return control?.errors?.['judgeUrl'] ?? null;
  }

  judgeRegexError(judge: FormGroup): string | null {
    const control = judge.get('regex');
    if (!control?.value && !control?.dirty && !control?.touched) {
      return null;
    }
    return judge.errors?.['judgeRegex'] ?? null;
  }

  judgeCheckSummary(judge: FormGroup): {text: string; bad: boolean; mono: boolean} {
    if (!this.judgeUrl(judge) && !this.judgeUrlError(judge)) {
      return {text: 'Add a URL', bad: false, mono: false};
    }
    if (this.judgeUrlError(judge)) {
      return {text: 'URL error', bad: true, mono: false};
    }
    if (this.judgeRegexError(judge)) {
      return {text: 'Pattern error', bad: true, mono: false};
    }
    if (this.usesRegex(judge)) {
      return {text: String(judge.get('regex')?.value ?? '').trim() || 'Regex', bad: false, mono: true};
    }
    return {text: 'Header check', bad: false, mono: false};
  }

  toggleJudge(index: number): void {
    this.openJudgeIndex.update(open => (open === index ? -1 : index));
  }

  addJudge(): void {
    this.judges.push(this.createJudgeGroup('', 'default'));
    this.settingsForm.markAsDirty();
    const index = this.judges.length - 1;
    this.openJudgeIndex.set(index);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>(`#judge-url-${index}`)?.focus());
  }

  removeJudge(index: number): void {
    if (index < 0 || index >= this.judges.length) {
      return;
    }
    this.judges.removeAt(index);
    this.settingsForm.markAsDirty();
    this.openJudgeIndex.update(open => {
      if (open === index) {
        return -1;
      }
      return open > index ? open - 1 : open;
    });
  }

  discardChanges(): void {
    if (this.saving()) {
      return;
    }
    if (this.lastCheckerSettings) {
      this.updateFormWithCheckerSettings(this.lastCheckerSettings);
    } else {
      this.settingsForm = this.createDefaultForm();
      this.updateThreadControlState(this.dynamicThreads);
      this.updateMonthlyAllowanceControlState(this.unlimitedMonthlyChecks);
    }
    if (this.lastProtocols) {
      this.updateProtocolsAndBlacklist(this.lastProtocols, this.lastBlacklist);
    }
    this.settingsForm.markAsPristine();
    this.changeDetector.markForCheck();
  }

  onSubmit(): void {
    if (this.saving() || this.settingsForm.invalid) {
      return;
    }

    const raw = this.settingsForm.getRawValue();
    const serializedJudges = this.judgeControls.map(judge => ({
      url: this.judgeUrl(judge),
      regex: this.usesRegex(judge) ? String(judge.get('regex')?.value ?? '').trim() : 'default',
    }));

    const payload = {
      ...raw,
      judges: serializedJudges,
    };

    this.saving.set(true);
    this.settingsService
      .saveGlobalSettings(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: resp => {
          this.notification.showSuccess(resp.message);
          this.lastCheckerSettings = {
            ...payload,
            ip_lookup: payload.iplookup,
          };
          this.lastProtocols = payload.protocols;
          this.lastBlacklist = payload.blacklisted ?? this.lastBlacklist;
          this.settingsForm.markAsPristine();
          this.changeDetector.markForCheck();
        },
        error: err => {
          console.error('Error saving settings:', err);
          const reason = err?.error?.message ?? err?.error?.error ?? 'Failed to save settings!';
          this.notification.showError(reason);
        },
      });
  }

  confirmRequeueAllProxies(): void {
    if (this.isRequeueing) {
      return;
    }

    this.confirmationService.confirm({
      message: 'Requeue every currently queued proxy using the latest checker cadence?',
      header: 'Confirm Requeue',
      acceptLabel: 'Requeue',
      accept: () => this.requeueAllProxies(),
    });
  }

  private requeueAllProxies(): void {
    this.isRequeueing = true;

    this.settingsService.requeueAllProxies().subscribe({
      next: resp => {
        const count = Number(resp?.proxy_count ?? 0);
        const suffix = Number.isFinite(count) ? ` (${count} proxies)` : '';
        this.notification.showSuccess(`${resp?.message ?? 'Queued proxies were requeued successfully'}${suffix}`);
        this.isRequeueing = false;
        this.changeDetector.markForCheck();
      },
      error: err => {
        const reason = err?.error?.message ?? err?.error?.error ?? 'Failed to requeue all proxies.';
        this.notification.showError(reason);
        this.isRequeueing = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private formatTimer(groupName: string): string {
    const timer = this.settingsForm.get(groupName)?.value ?? {};
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
}
