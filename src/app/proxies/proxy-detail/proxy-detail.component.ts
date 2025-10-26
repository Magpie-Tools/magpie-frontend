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

  chartData: any = { labels: [], datasets: [] };
  chartOptions: any = this.buildDefaultChartOptions();

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
