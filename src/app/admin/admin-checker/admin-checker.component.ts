import {ConfirmationService} from '../../shared/ui/confirmation.service';
import {HlmButton} from '@spartan-ng/helm/button';
import {HlmInput} from '@spartan-ng/helm/input';
import {HlmTabsImports} from '@spartan-ng/helm/tabs';
import {SelectComponent} from '../../shared/ui/select.component';
import {ConfirmDialogComponent} from '../../shared/ui/confirm-dialog.component';
import {ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {CheckboxComponent} from "../../checkbox/checkbox.component";
import {FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule} from "@angular/forms";

import {TooltipComponent} from "../../tooltip/tooltip.component";
import {SettingsService} from '../../services/settings.service';
import {take, takeUntil} from 'rxjs/operators';

import {NotificationService} from '../../services/notification-service.service';
import {Subject} from 'rxjs';

import {dayOptions, hourOptions, minuteOptions, secondOptions} from '../../shared/duration-options';
import {RevealGroupDirective, RevealStep} from '../../shared/reveal-group.directive';
import {AdminSettingsShellComponent} from '../../shared/admin-settings-shell/admin-settings-shell.component';
import {AdminSettingsHeaderComponent} from '../../shared/admin-settings-shell/admin-settings-header.component';
import {AdminSettingsSaveDockComponent} from '../../shared/admin-settings-shell/admin-settings-save-dock.component';

@Component({
  selector: 'app-admin-checker',
  standalone: true,
  imports: [HlmButton, HlmInput, HlmTabsImports, SelectComponent, ConfirmDialogComponent,
    CheckboxComponent,
    FormsModule,
    ReactiveFormsModule,
    TooltipComponent,

    RevealGroupDirective,
    AdminSettingsShellComponent,
    AdminSettingsHeaderComponent,
    AdminSettingsSaveDockComponent,
  ],
    providers: [ConfirmationService],
    templateUrl: './admin-checker.component.html',
    styleUrl: './admin-checker.component.scss'
})
export class AdminCheckerComponent implements OnInit, OnDestroy {
  settingsForm: FormGroup;
  readonly protocolOptions = [
    {label: 'HTTP', control: 'http', icon: 'icon icon-globe', description: 'Standard web traffic'},
    {label: 'HTTPS', control: 'https', icon: 'icon icon-lock', description: 'Encrypted web traffic'},
    {label: 'SOCKS4', control: 'socks4', icon: 'icon icon-network', description: 'IPv4 socket routing'},
    {label: 'SOCKS5', control: 'socks5', icon: 'icon icon-shield', description: 'Modern socket routing'},
  ];
  readonly daysList = dayOptions;
  readonly hoursList = hourOptions;
  readonly minutesList = minuteOptions;
  readonly secondsList = secondOptions;
  readonly revealSteps: readonly RevealStep[] = [{
    selector: '.admin-context, .settings-card, .save-dock',
    from: {opacity: 0, y: 20, scale: 0.99},
    to: {opacity: 1, y: 0, scale: 1, duration: 0.65, stagger: 0.055, ease: 'power3.out', clearProps: 'transform'},
  }];
  isRequeueing = false;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private changeDetector: ChangeDetectorRef,
    private settingsService: SettingsService,
    private notification: NotificationService,
    private confirmationService: ConfirmationService
  ) {
    this.settingsForm = this.createDefaultForm();
  }

  ngOnInit(): void {
    this.settingsService.getCheckerSettings().pipe(take(1)).subscribe({
      next: checkerSettings => {
        if (checkerSettings) {
          this.updateFormWithCheckerSettings(checkerSettings);
        }
      },
      error: err => {this.notification.showError("Could not get checker settings: " + err.error.message)}
    });

    const settings = this.settingsService.getGlobalSettings();
    if (settings) {
      this.updateProtocolsAndBlacklist(settings.protocols, settings.blacklist_sources);
    }

    this.settingsService.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe(settingsState => {
        if (!settingsState) {
          return;
        }
        this.updateProtocolsAndBlacklist(settingsState.protocols, settingsState.blacklist_sources);
      });

    const dynamicControl = this.settingsForm.get('dynamic_threads');
    this.updateThreadControlState(!!dynamicControl?.value);

    dynamicControl?.valueChanges
      ?.pipe(takeUntil(this.destroy$))
      .subscribe({
        next: dynamic => this.updateThreadControlState(!!dynamic),
        error: err => this.notification.showError("Could not get dynamic thread info " + err.error.message)
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createDefaultForm(): FormGroup {
    return this.fb.group({
      dynamic_threads: false,
      threads: [250],
      max_threads: [250],
      save_responses: [true],
      retries: [2],
      timeout: [7500],
      protocols: this.fb.group({
        http: [false],
        https: [true],
        socks4: [false],
        socks5: [false],
      }),
      checker_timer: this.fb.group({
        days: [0],
        hours: [1],
        minutes: [0],
        seconds: [0]
      }),
      judges_threads: [3],
      judges_timeout: [5000],
      judge_timer: this.fb.group({
        days: [0],
        hours: [0],
        minutes: [30],
        seconds: [0]
      }),
      judges: this.fb.array([
        this.fb.group({ url: ['https://pool.proxyspace.pro/judge.php'], regex: ['default'] }),
        this.fb.group({ url: ['http://azenv.net'], regex: ['default'] })
      ]),
      use_https_for_socks: true,
      iplookup: ['https://ident.me'],
      standard_header: this.fb.array([
        "USER-AGENT", "HOST", "ACCEPT", "ACCEPT-ENCODING"
      ]),
      proxy_header: this.fb.array([
        "HTTP_X_FORWARDED_FOR", "HTTP_FORWARDED", "HTTP_VIA", "HTTP_X_PROXY_ID"
      ]),
      blacklisted: this.fb.array([])
    });
  }

  private updateFormWithCheckerSettings(checkerSettings: any): void {
    // Update checker-specific fields
    this.settingsForm.patchValue({
      dynamic_threads: checkerSettings.dynamic_threads,
      threads: checkerSettings.threads,
      max_threads: checkerSettings.max_threads ?? checkerSettings.threads ?? 250,
      save_responses: checkerSettings.save_responses ?? true,
      retries: checkerSettings.retries,
      timeout: checkerSettings.timeout,
      checker_timer: {
        days: checkerSettings.checker_timer.days,
        hours: checkerSettings.checker_timer.hours,
        minutes: checkerSettings.checker_timer.minutes,
        seconds: checkerSettings.checker_timer.seconds
      },
      iplookup: checkerSettings.ip_lookup,
      judges_threads: checkerSettings.judges_threads,
      judges_timeout: checkerSettings.judges_timeout,
      use_https_for_socks: checkerSettings.use_https_for_socks
    });

    this.changeDetector.markForCheck();

    // Update judge timer if exists
    if (checkerSettings.judge_timer) {
      this.settingsForm.patchValue({
        judge_timer: {
          days: checkerSettings.judge_timer.days,
          hours: checkerSettings.judge_timer.hours,
          minutes: checkerSettings.judge_timer.minutes,
          seconds: checkerSettings.judge_timer.seconds
        }
      });
    }

    // Update judges array
    this.updateJudgesArray(checkerSettings.judges);

    // Update headers arrays
    this.updateHeadersArrays(
      checkerSettings.standard_header || ["USER-AGENT", "HOST", "ACCEPT", "ACCEPT-ENCODING"],
      checkerSettings.proxy_header || ["HTTP_X_FORWARDED_FOR", "HTTP_FORWARDED", "HTTP_VIA", "HTTP_X_PROXY_ID"]
    );
  }

  private updateProtocolsAndBlacklist(protocols: any, blacklist: string[]): void {
    if (protocols) {
      // Check if protocols is an object with boolean values
      if (protocols && typeof protocols === 'object') {
        const protocolsGroup = this.settingsForm.get('protocols') as FormGroup;

        // Set checkboxes based on protocol values
        Object.keys(protocols).forEach(protocol => {
          if (protocolsGroup.contains(protocol)) {
            protocolsGroup.get(protocol)?.setValue(!!protocols[protocol]);
          }
        });
      }
    }

    // Update blacklist
    const blacklistArray = this.settingsForm.get('blacklisted') as FormArray;
    blacklistArray.clear();

    (blacklist ?? []).forEach(url => {
      blacklistArray.push(this.fb.control(url));
    });

    blacklistArray.markAsPristine();
    this.changeDetector.markForCheck();
  }

  private updateJudgesArray(judges: any[]): void {
    if (!judges || judges.length === 0) return;

    const judgesArray = this.settingsForm.get('judges') as FormArray;
    judgesArray.clear();

    judges.forEach(judge => {
      judgesArray.push(this.fb.group({
        url: [judge.url],
        regex: [judge.regex]
      }));
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

  get judges() {
    return this.settingsForm.get('judges') as FormArray;
  }

  get selectedProtocolCount(): number {
    const protocols = this.settingsForm.get('protocols') as FormGroup;
    return this.protocolOptions.filter(option => !!protocols.get(option.control)?.value).length;
  }

  get checkerCadenceLabel(): string {
    return this.formatTimer('checker_timer');
  }

  get judgeCadenceLabel(): string {
    return this.formatTimer('judge_timer');
  }

  get checkerAttemptWindow(): string {
    const timeout = Number(this.settingsForm.get('timeout')?.value ?? 0);
    const retries = Number(this.settingsForm.get('retries')?.value ?? 0);
    const attempts = Math.max(1, Math.round(Number.isFinite(retries) ? retries : 0) + 1);
    const totalMilliseconds = Math.max(0, Number.isFinite(timeout) ? timeout : 0) * attempts;

    if (totalMilliseconds < 1000) {
      return `${Math.round(totalMilliseconds)} ms`;
    }

    const seconds = totalMilliseconds / 1000;
    return seconds < 60
      ? `${Number(seconds.toFixed(seconds >= 10 ? 0 : 1))} sec`
      : `${Number((seconds / 60).toFixed(1))} min`;
  }

  get threadLimit(): number {
    const controlName = this.settingsForm.get('dynamic_threads')?.value ? 'max_threads' : 'threads';
    const value = Number(this.settingsForm.get(controlName)?.value ?? 0);
    return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  }

  toggleProtocol(controlName: string): void {
    const control = this.settingsForm.get(`protocols.${controlName}`);
    if (!control) {
      return;
    }

    control.setValue(!control.value);
    control.markAsDirty();
  }

  onSubmit() {
    this.settingsService.saveGlobalSettings(this.settingsForm.value).subscribe({
      next: (resp) => {
        this.notification.showSuccess(resp.message)
        this.settingsForm.markAsPristine()
      },
      error: (err) => {
        console.error("Error saving settings:", err);
        const reason = err?.error?.message ?? err?.error?.error ?? "Failed to save settings!";
        this.notification.showError(reason);
      }
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
      accept: () => this.requeueAllProxies()
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
      },
      error: err => {
        const reason = err?.error?.message ?? err?.error?.error ?? 'Failed to requeue all proxies.';
        this.notification.showError(reason);
        this.isRequeueing = false;
      }
    });
  }

  addJudge(): void {
    this.judges.push(this.fb.group({
      url: [''],
      regex: ['default']
    }));
    this.settingsForm.markAsDirty();
  }

  removeJudge(index: number): void {
    this.judges.removeAt(index);
    this.settingsForm.markAsDirty();
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
