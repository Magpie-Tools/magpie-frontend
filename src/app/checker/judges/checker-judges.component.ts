import {HlmInput} from '@spartan-ng/helm/input';
import {HlmButton} from '@spartan-ng/helm/button';
import {AdminSettingsSaveDockComponent} from '../../shared/admin-settings-shell/admin-settings-save-dock.component';
import {SelectComponent} from '../../shared/ui/select.component';
import {ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, signal} from '@angular/core';
import {DecimalPipe} from '@angular/common';

import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';

import {SettingsService} from '../../services/settings.service';
import {NotificationService} from '../../services/notification-service.service';
import {GraphqlService, JudgeValidProxy} from '../../services/graphql.service';
import {CheckerProtocol, UserSettings} from '../../models/UserSettings';
import {Subject} from 'rxjs';
import {filter, takeUntil} from 'rxjs/operators';
import {WorkspaceService} from '../../services/workspace.service';
import {
  JudgeCheckMode,
  JudgeScheme,
  judgeRegexValidator,
  judgeScheme,
  judgeUrlValidator,
} from './judge-validation';

export interface JudgeCoverageCell {
  protocol: CheckerProtocol;
  label: string;
  state: 'judges' | 'shared' | 'missing' | 'off';
  text: string;
}

export interface JudgeResultCell {
  /** No count to show: the URL is invalid, unsaved, or results did not load. */
  unknown: boolean;
  total: number;
  /** Zero alive proxies while another judge for the same scheme finds some. */
  suspect: boolean;
  segments: {key: string; percent: number}[];
}

const PROTOCOL_LABELS: Record<CheckerProtocol, string> = {http: 'HTTP', https: 'HTTPS', socks4: 'SOCKS4', socks5: 'SOCKS5'};
const PROTOCOLS: CheckerProtocol[] = ['http', 'https', 'socks4', 'socks5'];

@Component({
  selector: 'app-checker-judges',
  standalone: true,
  imports: [HlmInput, HlmButton, AdminSettingsSaveDockComponent, ReactiveFormsModule, SelectComponent, DecimalPipe],
  templateUrl: './checker-judges.component.html',
  styleUrls: ['./checker-judges.component.scss']
})
export class CheckerJudgesComponent implements OnInit, OnDestroy {
  readonly checkModes: {label: string; value: JudgeCheckMode}[] = [
    {label: 'Header check', value: 'default'},
    {label: 'Regex', value: 'regex'},
  ];
  readonly openIndex = signal(-1);
  judgesForm: FormArray<FormGroup>;
  form: FormGroup<{judges: FormArray<FormGroup>}>;
  loaded = false;
  private settings: UserSettings | undefined;
  private savedUrls = new Set<string>();
  private results: Map<string, JudgeValidProxy> | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private changeDetector: ChangeDetectorRef,
    private settingsService: SettingsService,
    private notification: NotificationService,
    private graphql: GraphqlService,
    private host: ElementRef<HTMLElement>,
    readonly workspaces: WorkspaceService,
  ) {
    this.judgesForm = this.fb.array<FormGroup>([]);
    this.form = this.fb.group({judges: this.judgesForm});
  }

  ngOnInit(): void {
    this.populateJudges(this.settingsService.getUserSettings());

    this.settingsService.userSettings$
      .pipe(
        filter((settings): settings is UserSettings => !!settings),
        takeUntil(this.destroy$)
      )
      .subscribe(settings => this.populateJudges(settings));

    this.loadResults();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get judgeControls(): FormGroup[] {
    return this.judgesForm.controls as FormGroup[];
  }

  /** Which judges each proxy protocol uses, following the checker's scheme rules. */
  get coverage(): JudgeCoverageCell[] {
    const counts: Record<JudgeScheme, number> = {http: 0, https: 0};
    for (const judge of this.judgeControls) {
      const scheme = judgeScheme(this.url(judge));
      if (scheme && judge.get('url')?.valid) {
        counts[scheme]++;
      }
    }
    const enabled = this.enabledProtocols();
    return PROTOCOLS.map(protocol => {
      const label = PROTOCOL_LABELS[protocol];
      if (!enabled.has(protocol)) {
        return {protocol, label, state: 'off', text: 'Not enabled'};
      }
      const scheme = this.schemeFor(protocol);
      const count = counts[scheme];
      if (count === 0) {
        return {protocol, label, state: 'missing', text: 'Not checked'};
      }
      if (scheme !== protocol) {
        return {protocol, label, state: 'shared', text: `Uses ${scheme}:// judges`};
      }
      return {protocol, label, state: 'judges', text: count === 1 ? '1 judge' : `${count} judges`};
    });
  }

  /** The legend explains the result bars, so it shows only when at least one bar does. */
  get hasResultBars(): boolean {
    return this.judgeControls.some(judge => this.result(judge).total > 0);
  }

  url(judge: FormGroup): string {
    return String(judge.get('url')?.value ?? '').trim();
  }

  hostname(judge: FormGroup): string {
    const url = this.url(judge);
    try {
      return new URL(url).host || url;
    } catch {
      return url || 'New judge';
    }
  }

  path(judge: FormGroup): string {
    try {
      const parsed = new URL(this.url(judge));
      return (parsed.pathname === '/' ? '' : parsed.pathname) + parsed.search;
    } catch {
      return '';
    }
  }

  usesRegex(judge: FormGroup): boolean {
    return judge.get('mode')?.value === 'regex';
  }

  /** Hidden while a new row is still empty and untouched, so adding a judge does not open with an error. */
  urlError(judge: FormGroup): string | null {
    const control = judge.get('url');
    if (!control?.value && !control?.dirty && !control?.touched) {
      return null;
    }
    return control?.errors?.['judgeUrl'] ?? null;
  }

  regexError(judge: FormGroup): string | null {
    const control = judge.get('regex');
    if (!control?.value && !control?.dirty && !control?.touched) {
      return null;
    }
    return judge.errors?.['judgeRegex'] ?? null;
  }

  checkSummary(judge: FormGroup): {text: string; bad: boolean} {
    if (!this.url(judge) && !this.urlError(judge)) {
      return {text: 'Add a URL', bad: false};
    }
    if (this.urlError(judge)) {
      return {text: 'URL error', bad: true};
    }
    if (this.regexError(judge)) {
      return {text: 'Pattern error', bad: true};
    }
    return {text: this.usesRegex(judge) ? 'Regex' : 'Header check', bad: false};
  }

  result(judge: FormGroup): JudgeResultCell {
    const url = this.url(judge);
    const unknown: JudgeResultCell = {unknown: true, total: 0, suspect: false, segments: []};
    if (!this.results || judge.get('url')?.invalid || !this.savedUrls.has(url)) {
      return unknown;
    }
    const counts = this.results.get(url);
    const parts = [
      {key: 'elite', value: counts?.eliteProxies ?? 0},
      {key: 'anonymous', value: counts?.anonymousProxies ?? 0},
      {key: 'transparent', value: counts?.transparentProxies ?? 0},
    ];
    const total = parts.reduce((sum, part) => sum + part.value, 0);
    return {
      unknown: false,
      total,
      // A broken pattern also yields zero, and the Check column already says so.
      suspect: total === 0 && !judge.errors?.['judgeRegex'] && this.schemeHasResults(judgeScheme(url), url),
      segments: total ? parts.map(part => ({key: part.key, percent: (part.value / total) * 100})) : [],
    };
  }

  toggle(index: number): void {
    this.openIndex.update(open => (open === index ? -1 : index));
  }

  addJudge(): void {
    if (!this.workspaces.canOperate()) {
      return;
    }
    this.judgesForm.push(this.createJudgeGroup('', 'default'));
    this.judgesForm.markAsDirty();
    const index = this.judgesForm.length - 1;
    this.openIndex.set(index);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>(`#judge-url-${index}`)?.focus());
  }

  removeJudge(index: number): void {
    if (!this.workspaces.canOperate() || index < 0 || index >= this.judgesForm.length) {
      return;
    }

    this.judgesForm.removeAt(index);
    this.judgesForm.markAsDirty();
    this.openIndex.set(-1);
  }

  discard(): void {
    this.populateJudges(this.settings);
  }

  onSubmit(): void {
    if (!this.workspaces.canOperate() || this.judgesForm.invalid) {
      return;
    }
    const judges = this.judgeControls.map(judge => ({
      url: this.url(judge),
      regex: this.usesRegex(judge) ? String(judge.get('regex')?.value ?? '').trim() : 'default',
    }));

    this.settingsService.saveUserSettings({judges}).subscribe({
      next: (resp) => {
        this.notification.showSuccess(resp.message);
        this.populateJudges(this.settingsService.getUserSettings());
        this.loadResults();
      },
      error: (err) => {
        console.error('Error saving judges:', err);
        const reason = err?.error?.message ?? err?.error?.error ?? 'Failed to save settings!';
        this.notification.showError(reason);
      }
    });
  }

  private loadResults(): void {
    this.graphql.fetchJudgeValidProxies().pipe(takeUntil(this.destroy$)).subscribe({
      next: rows => {
        this.results = rows ? new Map(rows.map(row => [row.judgeUrl.trim(), row])) : null;
        this.changeDetector.markForCheck();
      },
      error: () => {
        // Counts are a hint; the page stays usable without them.
        this.results = null;
        this.changeDetector.markForCheck();
      },
    });
  }

  private schemeHasResults(scheme: JudgeScheme | null, except: string): boolean {
    if (!scheme || !this.results) {
      return false;
    }
    return this.judgeControls.some(judge => {
      const url = this.url(judge);
      if (url === except || judgeScheme(url) !== scheme) {
        return false;
      }
      const row = this.results!.get(url);
      return !!row && row.eliteProxies + row.anonymousProxies + row.transparentProxies > 0;
    });
  }

  private enabledProtocols(): Set<CheckerProtocol> {
    const settings = this.settings;
    const checker = settings?.checker_settings;
    if (checker) {
      const enabled = new Set<CheckerProtocol>(checker.defaults?.protocols ?? []);
      // A tag rule can switch a protocol on for some proxies.
      for (const rule of checker.rules ?? []) {
        if (rule.mode !== 'remove') {
          rule.protocols.forEach(protocol => enabled.add(protocol));
        }
      }
      return enabled;
    }
    const flags: Record<CheckerProtocol, boolean | undefined> = {
      http: settings?.http_protocol,
      https: settings?.https_protocol,
      socks4: settings?.socks4_protocol,
      socks5: settings?.socks5_protocol,
    };
    return new Set(PROTOCOLS.filter(protocol => flags[protocol] ?? true));
  }

  private schemeFor(protocol: CheckerProtocol): JudgeScheme {
    const transport = String(this.settings?.checker_settings?.defaults?.transport ?? this.settings?.transport_protocol ?? '').toLowerCase();
    if (transport === 'quic' || transport === 'http3') {
      return 'https';
    }
    if (protocol === 'http' || protocol === 'https') {
      return protocol;
    }
    return (this.settings?.UseHttpsForSocks ?? true) ? 'https' : 'http';
  }

  private populateJudges(settings: UserSettings | undefined): void {
    this.settings = settings;
    this.loaded = !!settings;
    this.judgesForm.clear();
    this.openIndex.set(-1);

    const judges = settings?.judges ?? [];
    judges.forEach(judge => this.judgesForm.push(this.createJudgeGroup(judge.url, judge.regex)));
    this.savedUrls = new Set(judges.map(judge => String(judge.url ?? '').trim()));

    this.judgesForm.markAsPristine();
    this.changeDetector.markForCheck();
  }

  private createJudgeGroup(url: string = '', regex: string = 'default'): FormGroup {
    const usesHeaders = !regex || regex.trim().toLowerCase() === 'default';
    return this.fb.group({
      url: [url, judgeUrlValidator],
      mode: [usesHeaders ? 'default' : 'regex'],
      regex: [usesHeaders ? '' : regex],
    }, {validators: judgeRegexValidator});
  }
}
