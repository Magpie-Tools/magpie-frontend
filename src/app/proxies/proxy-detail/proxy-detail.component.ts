import {Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule, DatePipe, NgClass} from '@angular/common';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {UIChart} from 'primeng/chart';
import {TableModule} from 'primeng/table';
import {ButtonModule} from 'primeng/button';
import {DialogModule} from 'primeng/dialog';
import {ClipboardModule, Clipboard} from '@angular/cdk/clipboard';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {ProxyDetail} from '../../models/ProxyDetail';
import {ProxyStatistic} from '../../models/ProxyStatistic';
import {ProxyReputation} from '../../models/ProxyReputation';
import {HttpService} from '../../services/http.service';
import {Subscription} from 'rxjs';
import {NotificationService} from '../../services/notification-service.service';
import {LoadingComponent} from '../../ui-elements/loading/loading.component';

interface ThemePalette {
  primary: string;
  primarySoft: string;
  text: string;
  muted: string;
  gridStrong: string;
  gridLight: string;
}

type SignalTone = 'positive' | 'neutral' | 'negative';

interface ReputationSignalEntry {
  key: string;
  rawKey: string;
  value: string;
  tone: SignalTone;
  isJson: boolean;
  structuredItems?: ReputationSignalStructuredItem[];
}

interface ReputationSignalStructuredItem {
  label: string;
  value?: string;
  children?: ReputationSignalStructuredItem[];
  layout?: 'protocol';
}

@Component({
  selector: 'app-proxy-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    UIChart,
    TableModule,
    ButtonModule,
    DialogModule,
    ClipboardModule,
    LoadingComponent,
    DatePipe,
    NgClass,
  ],
  templateUrl: './proxy-detail.component.html',
  styleUrl: './proxy-detail.component.scss'
})
export class ProxyDetailComponent implements OnInit, OnDestroy {
  proxyId?: number;
  detail?: ProxyDetail | null;
  statistics: ProxyStatistic[] = [];
  chronologicalStats: ProxyStatistic[] = [];

  isLoadingDetail = true;
  isLoadingStatistics = true;
  isResponseBodyModalVisible = false;
  isLoadingResponseBody = false;
  selectedStatistic: ProxyStatistic | null = null;
  selectedResponseBody = '';
  selectedRegex: string | null = null;
  highlightedResponseBody: SafeHtml | null = null;
  responseBodyError: string | null = null;
  isSignalDialogVisible = false;
  signalDialogTitle = '';
  signalDialogEntries: ReputationSignalEntry[] = [];

  chartData: any = { labels: [], datasets: [] };
  chartOptions: any = this.buildDefaultChartOptions();

  private readonly structuredMaxDepth = 3;
  private readonly signalNumberPrecision = 10;

  private subscriptions = new Subscription();
  private responseBodySubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpService,
    private clipboard: Clipboard,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    const sub = this.route.paramMap.subscribe(params => {
      const rawId = params.get('id');
      const id = rawId ? Number(rawId) : NaN;
      if (!Number.isFinite(id) || id <= 0) {
        NotificationService.showError('Invalid proxy identifier');
        this.router.navigate(['/proxies']).catch(() => {});
        return;
      }

      this.proxyId = id;
      this.loadProxyDetail(id);
      this.loadProxyStatistics(id);
    });

    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.responseBodySubscription?.unsubscribe();
    this.subscriptions.unsubscribe();
  }

  get fullAddress(): string {
    if (!this.detail) {
      return '';
    }
    const ip = `${this.detail.ip ?? ''}`.trim();
    const port = this.detail.port;
    if (!ip && (port === undefined || port === null || `${port}`.trim() === '')) {
      return '';
    }
    if (!ip) {
      return `${port ?? ''}`;
    }
    if (port === undefined || port === null || `${port}`.trim() === '') {
      return ip;
    }
    return `${ip}:${port}`;
  }

  get externalLookupLinks(): { label: string; url: string; icon: string }[] {
    const ip = this.detail?.ip?.toString().trim();
    if (!ip) {
      return [];
    }

    const encodedIp = encodeURIComponent(ip);
    return [
      {
        label: 'Talos Intelligence',
        url: `https://talosintelligence.com/reputation_center/lookup?search=${encodedIp}`,
        icon: '',
        // icon: 'https://talosintelligence.com/favicon.ico',
      },
      {
        label: 'AbuseIPDB',
        url: `https://www.abuseipdb.com/check/${encodedIp}`,
        icon: 'https://www.abuseipdb.com/favicon.ico',
      },
      {
        label: 'Scamalytics',
        url: `https://scamalytics.com/ip/${encodedIp}`,
        icon: '',
        // icon: 'https://scamalytics.com/wp-content/uploads/2016/06/icon_128.png',
      },
      {
        label: 'Shodan',
        url: `https://www.shodan.io/host/${encodedIp}`,
        icon: '',
        // icon: 'https://www.shodan.io/static/img/favicon-60c1b1cd.png',
      },
      {
        label: 'IPQS',
        url: `https://www.ipqualityscore.com/free-ip-lookup-proxy-vpn-test/lookup/${encodedIp}`,
        icon: ''
        // icon: 'https://www.ipqualityscore.com/favicon.ico'
      }
    ];
  }

  copyIp(): void {
    const value = this.detail?.ip?.toString().trim();
    if (!value) {
      return;
    }
    this.copyToClipboard(value, 'IP address copied');
  }

  copyPort(): void {
    const value = this.detail?.port;
    if (value === undefined || value === null) {
      return;
    }
    this.copyToClipboard(`${value}`, 'Port copied');
  }

  copyFullAddress(): void {
    const value = this.fullAddress;
    if (!value) {
      return;
    }
    this.copyToClipboard(value, 'Proxy address copied');
  }

  copyUsername(): void {
    const username = this.authenticationCredentials?.username;
    if (!username) {
      return;
    }
    this.copyToClipboard(username, 'Username copied');
  }

  copyPassword(): void {
    const password = this.authenticationCredentials?.password;
    if (!password) {
      return;
    }
    this.copyToClipboard(password, 'Password copied');
  }

  copyAuthCredentials(): void {
    const combined = this.authenticationCredentials?.combined;
    if (!combined) {
      return;
    }
    this.copyToClipboard(combined, 'Credentials copied');
  }

  copyFullCredentialAddress(): void {
    const value = this.fullCredentialAddress;
    if (!value) {
      return;
    }
    this.copyToClipboard(value, 'Proxy endpoint copied');
  }

  private copyToClipboard(value: string, successMessage: string): void {
    const copied = this.clipboard.copy(value);
    if (copied) {
      NotificationService.showSuccess(successMessage);
      return;
    }

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(
        () => NotificationService.showSuccess(successMessage),
        () => NotificationService.showError('Failed to access clipboard')
      );
      return;
    }

    NotificationService.showError('Clipboard not available');
  }

  get authenticationDisplay(): string {
    if (!this.detail) {
      return 'Unknown';
    }

    if (!this.detail.has_auth) {
      return 'None';
    }

    const user = this.detail.username?.trim();
    const pass = this.detail.password?.trim();
    if (!user && !pass) {
      return 'Present (masked)';
    }

    if (user && pass) {
      return `${user}:${pass}`;
    }

    return user || pass || 'Present';
  }

  get authenticationCredentials(): { username: string; password: string; combined: string } | null {
    if (!this.detail?.has_auth) {
      return null;
    }

    const username = this.detail.username?.trim();
    const password = this.detail.password?.trim();
    if (!username || !password) {
      return null;
    }

    return {
      username,
      password,
      combined: `${username}:${password}`,
    };
  }

  get fullCredentialAddress(): string {
    const credentials = this.authenticationCredentials;
    if (!credentials) {
      return '';
    }

    const ip = this.detail?.ip?.toString().trim();
    const portValue = this.detail?.port;
    const port = portValue === undefined || portValue === null ? '' : `${portValue}`.trim();
    if (!ip || !port) {
      return '';
    }

    return `${ip}:${port}:${credentials.username}:${credentials.password}`;
  }

  get latestStatistic(): ProxyStatistic | null {
    if (this.detail?.latest_statistic) {
      return this.detail.latest_statistic;
    }

    if (this.statistics.length > 0) {
      return this.statistics[0];
    }

    return null;
  }

  get reputationOverall(): ProxyReputation | null {
    const overall = this.detail?.reputation?.overall;
    if (!overall) {
      return null;
    }
    return {
      kind: overall.kind || 'overall',
      score: overall.score ?? 0,
      label: overall.label ?? 'unknown',
      signals: overall.signals,
    };
  }

  get reputationProtocols(): ProxyReputation[] {
    const protocols = this.detail?.reputation?.protocols;
    if (!protocols) {
      return [];
    }

    const entries: ProxyReputation[] = [];
    Object.entries(protocols).forEach(([kind, rep]) => {
      if (!rep) {
        return;
      }
      entries.push({
        kind: rep.kind || kind,
        score: rep.score ?? 0,
        label: rep.label ?? 'unknown',
        signals: rep.signals,
      });
    });

    return entries.sort((a, b) => b.score - a.score);
  }

  get hasReputation(): boolean {
    return !!this.reputationOverall || this.reputationProtocols.length > 0;
  }

  reputationBadgeClass(label?: string | null): string {
    const normalised = (label || '').toLowerCase();
    if (normalised === 'good') {
      return 'reputation-badge reputation-badge--good';
    }
    if (normalised === 'neutral') {
      return 'reputation-badge reputation-badge--neutral';
    }
    if (normalised === 'poor') {
      return 'reputation-badge reputation-badge--poor';
    }
    return 'reputation-badge reputation-badge--unknown';
  }

  reputationScoreDisplay(rep?: ProxyReputation | null): string {
    if (!rep) {
      return '—';
    }
    return Math.round(rep.score ?? 0).toString();
  }

  reputationScorePercent(rep?: ProxyReputation | null): number {
    if (!rep) {
      return 0;
    }
    const score = rep.score ?? 0;
    const rounded = Math.round(score);
    return Math.min(100, Math.max(0, rounded));
  }

  reputationSignalEntries(rep?: ProxyReputation | null, limit: number = 8): ReputationSignalEntry[] {
    const signals = rep?.signals;
    if (!signals) {
      return [];
    }

    const entriesWithMeta = Object.entries(signals)
      .filter(([key]) => key && key.trim().length > 0)
      .map(([key, value], index) => {
        const formatted = this.formatSignalValue(value, key);
        return {
          rawKey: key,
          displayKey: this.humanizeSignalLabel(key),
          value,
          formatted,
          tone: this.determineSignalTone(key, value),
          index,
        };
      })
      .sort((a, b) => {
        const orderDiff = this.signalEntryPriority(rep, a.rawKey) - this.signalEntryPriority(rep, b.rawKey);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return a.index - b.index;
      })
      .map(meta => ({
        key: meta.displayKey,
        rawKey: meta.rawKey,
        value: meta.formatted.text,
        tone: meta.tone,
        isJson: meta.formatted.isJson,
        structuredItems: meta.formatted.structuredItems,
      }));

    if (limit === Infinity) {
      return entriesWithMeta;
    }

    if (!Number.isFinite(limit) || limit <= 0) {
      return [];
    }

    return entriesWithMeta.slice(0, limit);
  }

  openSignalsDialog(rep: ProxyReputation): void {
    this.signalDialogEntries = this.reputationSignalEntries(rep, Infinity);
    const rawKind = rep.kind?.replace(/_/g, ' ').trim() ?? '';
    if (!rawKind) {
      this.signalDialogTitle = 'Signals';
    } else if (rawKind.toLowerCase() === 'overall') {
      this.signalDialogTitle = 'Overall Signals';
    } else {
      this.signalDialogTitle = `${rawKind.toUpperCase()} Signals`;
    }
    this.isSignalDialogVisible = true;
  }

  onSignalDialogHide(): void {
    this.isSignalDialogVisible = false;
    this.signalDialogEntries = [];
    this.signalDialogTitle = '';
  }

  signalToneClass(tone: SignalTone): string {
    if (tone === 'positive') {
      return 'signal-value--positive';
    }
    if (tone === 'negative') {
      return 'signal-value--negative';
    }
    return 'signal-value--neutral';
  }

  signalToneLabel(tone: SignalTone): string {
    if (tone === 'positive') {
      return 'Good';
    }
    if (tone === 'negative') {
      return 'Poor';
    }
    return 'Neutral';
  }

  isProtocolList(items?: ReputationSignalStructuredItem[] | null): boolean {
    if (!items || items.length === 0) {
      return false;
    }
    return items.every(item => item.layout === 'protocol');
  }

  hasSignals(rep?: ProxyReputation | null): boolean {
    return this.reputationSignalEntries(rep, 1).length > 0;
  }

  progressFillClass(label?: string | null): string {
    const normalised = (label || '').toLowerCase();
    if (normalised === 'good') {
      return 'progress-bar__fill--good';
    }
    if (normalised === 'neutral') {
      return 'progress-bar__fill--neutral';
    }
    if (normalised === 'poor') {
      return 'progress-bar__fill--poor';
    }
    return 'progress-bar__fill--unknown';
  }

  private loadProxyDetail(id: number): void {
    this.isLoadingDetail = true;
    const sub = this.http.getProxyDetail(id).subscribe({
      next: detail => {
        this.detail = detail;
        this.isLoadingDetail = false;
        this.updateChart();
      },
      error: err => {
        this.isLoadingDetail = false;
        const message = err?.error?.error ?? err?.message ?? 'Failed to load proxy';
        NotificationService.showError(message);
        this.router.navigate(['/proxies']).catch(() => {});
      }
    });

    this.subscriptions.add(sub);
  }

  private formatSignalValue(
    value: unknown,
    rawKey?: string
  ): { text: string; isJson: boolean; structuredItems?: ReputationSignalStructuredItem[] } {
    if (value === null || value === undefined) {
      return { text: '—', isJson: false };
    }

    const structuredItems = this.buildStructuredItems(value, 0, rawKey);
    if (structuredItems && structuredItems.length > 0) {
      return { text: '', isJson: false, structuredItems };
    }

    if (typeof value === 'boolean') {
      return { text: value ? 'Yes' : 'No', isJson: false };
    }

    if (typeof value === 'number') {
      return { text: this.formatNumber(value), isJson: false };
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return { text: trimmed || '—', isJson: false };
    }

    const jsonText = this.stringifyCompact(value);
    const isJson = jsonText !== '—';
    return { text: jsonText, isJson };
  }

  private buildStructuredItems(
    value: unknown,
    depth = 0,
    parentKey?: string
  ): ReputationSignalStructuredItem[] | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (this.isPrimitiveValue(value) || value instanceof Date) {
      return null;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return [{ label: 'Entries', value: '—' }];
      }
      return value.map((entry, index) =>
        this.buildStructuredEntry(`Entry ${index + 1}`, entry, depth + 1, `${index}`, parentKey)
      );
    }

    if (this.isPlainObject(value)) {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        return [{ label: 'Value', value: '—' }];
      }
      return entries.map(([key, entryValue]) =>
        this.buildStructuredEntry(this.humanizeSignalLabel(key), entryValue, depth + 1, key, parentKey)
      );
    }

    return null;
  }

  private resolveStructuredLayout(parentKey?: string): 'protocol' | undefined {
    if (!parentKey) {
      return undefined;
    }
    const normalised = parentKey.trim().toLowerCase();
    if (normalised === 'components') {
      return 'protocol';
    }
    return undefined;
  }

  private buildStructuredEntry(
    label: string,
    value: unknown,
    depth: number,
    rawKey: string,
    parentKey?: string
  ): ReputationSignalStructuredItem {
    const item: ReputationSignalStructuredItem = {
      label,
    };

    const layout = this.resolveStructuredLayout(parentKey);
    if (layout) {
      item.layout = layout;
    }

    if (this.isPrimitiveValue(value) || value instanceof Date) {
      item.value = this.formatPrimitiveValue(value);
      return item;
    }

    if (depth >= this.structuredMaxDepth) {
      item.value = this.stringifyCompact(value);
      return item;
    }

    const children = this.buildStructuredItems(value, depth, rawKey);
    if (children && children.length > 0) {
      item.children = children;
      return item;
    }

    item.value = this.stringifyCompact(value);
    return item;
  }

  private isPrimitiveValue(value: unknown): boolean {
    const type = typeof value;
    return (
      value === null ||
      value === undefined ||
      type === 'string' ||
      type === 'number' ||
      type === 'boolean' ||
      type === 'bigint' ||
      type === 'symbol'
    );
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object') {
      return false;
    }
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  private formatPrimitiveValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '—';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (typeof value === 'number') {
      return this.formatNumber(value);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || '—';
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return this.stringifyCompact(value);
  }

  private stringifyCompact(value: unknown): string {
    try {
      if (typeof value === 'string') {
        return value;
      }
      return JSON.stringify(
        value,
        (key, val) => {
          if (typeof val === 'number') {
            if (!Number.isFinite(val)) {
              return val;
            }
            return this.roundNumber(val);
          }
          return val;
        },
        2
      );
    } catch {
      return '—';
    }
  }

  private humanizeSignalLabel(rawKey: string): string {
    const cleaned = rawKey.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      return rawKey;
    }
    return cleaned.replace(/\b\w/g, char => char.toUpperCase());
  }

  private signalEntryPriority(rep: ProxyReputation | null | undefined, rawKey: string): number {
    const normalisedKey = rawKey.trim().toLowerCase();
    const normalisedKind = rep?.kind?.trim().toLowerCase();
    if (normalisedKind === '<overall') {
      if (normalisedKey === 'components' || normalisedKey === 'protocols') {
        return 0;
      }
      if (normalisedKey === 'combined') {
        return 1;
      }
    }
    return 5;
  }

  private formatNumber(value: number): string {
    if (!Number.isFinite(value)) {
      return '—';
    }
    const rounded = this.roundNumber(value);
    if (Number.isInteger(rounded)) {
      return `${rounded}`;
    }
    return rounded
      .toFixed(this.signalNumberPrecision)
      .replace(/\.?0+$/, '');
  }

  private roundNumber(value: number): number {
    if (!Number.isFinite(value)) {
      return value;
    }
    const factor = Math.pow(10, this.signalNumberPrecision);
    const rounded = Math.round(value * factor) / factor;
    // Avoid negative zero
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  private determineSignalTone(rawKey: string, value: unknown): SignalTone {
    const key = rawKey.trim().toLowerCase();

    if (typeof value === 'number') {
      if (this.isScoreSignal(key)) {
        return this.toneForScore(value);
      }
      if (key === 'latency_median_ms') {
        if (value <= 600) {
          return 'positive';
        }
        if (value <= 2000) {
          return 'neutral';
        }
        return 'negative';
      }
      if (key === 'recency_minutes') {
        if (value <= 30) {
          return 'positive';
        }
        if (value <= 180) {
          return 'neutral';
        }
        return 'negative';
      }
      if (key === 'failure_streak') {
        if (value === 0) {
          return 'positive';
        }
        if (value <= 2) {
          return 'neutral';
        }
        return 'negative';
      }

      if (value < 0) {
        return 'negative';
      }

      return 'neutral';
    }

    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();
      if (!trimmed) {
        return 'neutral';
      }
      if (key === 'anonymity') {
        return this.toneForScore(this.anonymityScore(trimmed));
      }
      if (key === 'estimated_type') {
        return this.toneForScore(this.estimatedTypeScore(trimmed));
      }

      if (['true', 'yes', 'low', 'good', 'success'].some(token => trimmed.includes(token))) {
        return 'positive';
      }
      if (['false', 'no', 'high', 'bad', 'poor', 'fail'].some(token => trimmed.includes(token))) {
        return 'negative';
      }

      return 'neutral';
    }

    if (typeof value === 'boolean') {
      return value ? 'positive' : 'negative';
    }

    return 'neutral';
  }

  private isScoreSignal(key: string): boolean {
    return [
      'uptime_score',
      'uptime_ratio',
      'recency_score',
      'latency_score',
      'anonymity_score',
      'failures_score',
    ].includes(key);
  }

  private toneForScore(rawScore: number): SignalTone {
    if (!Number.isFinite(rawScore)) {
      return 'neutral';
    }

    const score = rawScore > 1 ? rawScore / 100 : rawScore;
    if (score >= 0.66) {
      return 'positive';
    }
    if (score >= 0.33) {
      return 'neutral';
    }
    return 'negative';
  }

  private anonymityScore(value: string): number {
    const map: Record<string, number> = {
      elite: 1.0,
      anonymous: 0.8,
      transparent: 0.3,
    };
    return map[value] ?? 0.5;
  }

  private estimatedTypeScore(value: string): number {
    const map: Record<string, number> = {
      residential: 1.0,
      isp: 0.9,
      mobile: 0.85,
      datacenter: 0.4,
    };
    return map[value] ?? 0.6;
  }

  private loadProxyStatistics(id: number): void {
    this.isLoadingStatistics = true;
    const sub = this.http.getProxyStatistics(id, { limit: 150 }).subscribe({
      next: stats => {
        this.statistics = stats;
        this.isLoadingStatistics = false;
        this.updateChart();
      },
      error: err => {
        this.isLoadingStatistics = false;
        const message = err?.error?.error ?? err?.message ?? 'Failed to load proxy statistics';
        NotificationService.showError(message);
      }
    });

    this.subscriptions.add(sub);
  }

  openStatisticResponse(row: ProxyStatistic): void {
    if (!this.proxyId) {
      NotificationService.showError('Unable to determine proxy identifier');
      return;
    }

    this.isResponseBodyModalVisible = true;
    this.isLoadingResponseBody = true;
    this.selectedStatistic = row;
    this.selectedResponseBody = '';
    this.selectedRegex = null;
    this.highlightedResponseBody = null;
    this.responseBodyError = null;

    this.responseBodySubscription?.unsubscribe();
    const sub = this.http.getProxyStatisticResponseBody(this.proxyId, row.id).subscribe({
      next: detail => {
        this.selectedResponseBody = detail.response_body;
        this.selectedRegex = detail.regex;
        this.highlightedResponseBody = this.buildHighlightedResponse(detail.response_body, detail.regex);
        this.isLoadingResponseBody = false;
      },
      error: err => {
        this.responseBodyError = err?.error?.error ?? err?.message ?? 'Failed to load response body';
        this.selectedRegex = null;
        this.highlightedResponseBody = this.buildHighlightedResponse('', null);
        this.isLoadingResponseBody = false;
      }
    });

    this.responseBodySubscription = sub;
    this.subscriptions.add(sub);
  }

  onResponseDialogHide(): void {
    this.isResponseBodyModalVisible = false;
    this.responseBodySubscription?.unsubscribe();
    this.responseBodySubscription = undefined;
    this.selectedResponseBody = '';
    this.selectedRegex = null;
    this.highlightedResponseBody = null;
    this.responseBodyError = null;
  }

  private buildHighlightedResponse(body: string, regex: string | null): SafeHtml {
    if (!body) {
      return this.sanitizer.bypassSecurityTrustHtml('');
    }

    const effectiveRegex = regex?.trim();
    if (!effectiveRegex) {
      return this.sanitizer.bypassSecurityTrustHtml(this.escapeHtml(body));
    }

    const highlighted = this.applyHighlight(body, effectiveRegex);
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }

  private applyHighlight(body: string, regex: string): string {
    if (regex.toLowerCase() === 'default') {
      return this.highlightDefaultHeaders(body);
    }

    const pattern = this.createRegExp(regex);
    if (!pattern) {
      return this.escapeHtml(body);
    }

    return this.wrapMatches(body, pattern);
  }

  private createRegExp(pattern: string): RegExp | null {
    const trimmed = pattern.trim();
    if (!trimmed) {
      return null;
    }

    const delimited = trimmed.match(/^\/([\s\S]+)\/([a-z]*)$/i);
    if (delimited) {
      let flags = delimited[2] ?? '';
      if (!flags.includes('g')) {
        flags += 'g';
      }
      try {
        return new RegExp(delimited[1], flags);
      } catch {
        return null;
      }
    }

    try {
      return new RegExp(trimmed, 'g');
    } catch {
      try {
        return new RegExp(trimmed);
      } catch {
        return null;
      }
    }
  }

  private highlightDefaultHeaders(body: string): string {
    const tokens = this.defaultHeaderTokens;
    if (!tokens.length) {
      return this.escapeHtml(body);
    }

    const pattern = tokens
      .map(token => this.escapeForRegExp(token).replace(/\\-/g, '[-_]'))
      .join('|');

    if (!pattern) {
      return this.escapeHtml(body);
    }

    try {
      const regex = new RegExp(`(${pattern})`, 'gi');
      return this.wrapMatches(body, regex);
    } catch {
      return this.escapeHtml(body);
    }
  }

  private wrapMatches(body: string, regex: RegExp): string {
    const pieces: string[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
    let globalRegex: RegExp;
    try {
      globalRegex = regex.global ? regex : new RegExp(regex.source, flags);
    } catch {
      globalRegex = regex;
    }

    while ((match = globalRegex.exec(body)) !== null) {
      const start = match.index;
      const matchedText = match[0];
      const end = start + matchedText.length;

      if (start >= 0 && matchedText.length > 0) {
        pieces.push(this.escapeHtml(body.slice(lastIndex, start)));
        pieces.push(`<mark>${this.escapeHtml(matchedText)}</mark>`);
        lastIndex = end;
      }

      if (matchedText.length === 0) {
        globalRegex.lastIndex += 1;
      }
    }

    pieces.push(this.escapeHtml(body.slice(lastIndex)));

    return pieces.join('');
  }

  private escapeForRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private escapeHtml(value: string): string {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return value.replace(/[&<>"']/g, char => replacements[char]);
  }

  private get defaultHeaderTokens(): string[] {
    return ['USER-AGENT', 'HOST', 'ACCEPT', 'ACCEPT-ENCODING'];
  }

  private updateChart(): void {
    this.chronologicalStats = this.computeChronologicalStatistics();
    const points: ProxyStatistic[] = this.chronologicalStats;

    const palette = this.getThemePalette();

    if (!points.length) {
      this.chartData = {
        labels: [],
        datasets: [
          {
            data: [],
            borderColor: palette.primary,
            backgroundColor: palette.primarySoft,
            tension: 0.35,
            fill: true,
            pointRadius: 0,
            borderWidth: 2,
          }
        ]
      };
      this.chartOptions = this.buildDefaultChartOptions(palette);
      return;
    }

    const formatter = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const labels = points.map(p => {
      const parsed = new Date(p.created_at);
      return Number.isNaN(parsed.getTime()) ? '—' : formatter.format(parsed);
    });
    const values = points.map(p => p.response_time);

    this.chartData = {
      labels,
      datasets: [
        {
          label: 'Response Time (ms)',
          data: values,
          borderColor: palette.primary,
          backgroundColor: palette.primarySoft,
          tension: 0.35,
          fill: true,
          pointRadius: 0,
          pointHitRadius: 8,
          borderWidth: 2,
        }
      ]
    };

    this.chartOptions = this.buildDefaultChartOptions(palette);
  }

  private computeChronologicalStatistics(): ProxyStatistic[] {
    if (this.statistics.length) {
      return [...this.statistics].sort((a, b) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    }

    if (this.detail?.latest_statistic) {
      return [this.detail.latest_statistic];
    }

    return [];
  }

  private getThemePalette(): ThemePalette {
    const fallback: ThemePalette = {
      primary: '#3b82f6',
      primarySoft: 'rgba(59, 130, 246, 0.2)',
      text: '#e2e8f0',
      muted: 'rgba(148, 163, 184, 0.82)',
      gridStrong: 'rgba(148, 163, 184, 0.18)',
      gridLight: 'rgba(148, 163, 184, 0.12)',
    };

    if (typeof window === 'undefined') {
      return fallback;
    }

    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue('--theme-primary-500').trim() || fallback.primary;
    const primarySoft = styles.getPropertyValue('--theme-primary-soft-bg').trim() || fallback.primarySoft;
    const text = styles.getPropertyValue('--theme-text-color').trim() || fallback.text;
    const muted = styles.getPropertyValue('--theme-primary-200').trim() || fallback.muted;
    const primaryRgb = styles.getPropertyValue('--theme-primary-500-rgb').trim();

    const gridStrong = primaryRgb ? `rgba(${primaryRgb}, 0.18)` : fallback.gridStrong;
    const gridLight = primaryRgb ? `rgba(${primaryRgb}, 0.12)` : fallback.gridLight;

    return {
      primary,
      primarySoft,
      text,
      muted,
      gridStrong,
      gridLight,
    };
  }

  private buildDefaultChartOptions(palette: ThemePalette = this.getThemePalette()): any {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (context: any) => `${context.parsed.y} ms`
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'nearest'
      },
      scales: {
        x: {
          ticks: {
            color: palette.muted
          },
          grid: {
            color: palette.gridLight
          }
        },
        y: {
          ticks: {
            color: palette.muted,
            callback: (value: number | string) => `${value} ms`
          },
          grid: {
            color: palette.gridStrong
          }
        }
      }
    };
  }
}
