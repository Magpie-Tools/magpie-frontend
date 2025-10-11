import {Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule, DatePipe, NgClass} from '@angular/common';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {UIChart} from 'primeng/chart';
import {TableModule} from 'primeng/table';
import {ButtonModule} from 'primeng/button';
import {ClipboardModule, Clipboard} from '@angular/cdk/clipboard';
import {ProxyDetail} from '../../models/ProxyDetail';
import {ProxyStatistic} from '../../models/ProxyStatistic';
import {HttpService} from '../../services/http.service';
import {Subscription} from 'rxjs';
import {NotificationService} from '../../services/notification-service.service';
import {LoadingComponent} from '../../ui-elements/loading/loading.component';

@Component({
  selector: 'app-proxy-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    UIChart,
    TableModule,
    ButtonModule,
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

  chartData: any = { labels: [], datasets: [] };
  chartOptions: any = this.buildDefaultChartOptions();

  private subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpService,
    private clipboard: Clipboard,
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

  get externalLookupLinks(): { label: string; url: string }[] {
    const ip = this.detail?.ip?.toString().trim();
    if (!ip) {
      return [];
    }

    const encodedIp = encodeURIComponent(ip);
    return [
      {
        label: 'Talos Intelligence',
        url: `https://talosintelligence.com/reputation_center/lookup?search=${encodedIp}`,
      },
      {
        label: 'AbuseIPDB',
        url: `https://www.abuseipdb.com/check/${encodedIp}`,
      },
      {
        label: 'Scamalytics',
        url: `https://scamalytics.com/ip/${encodedIp}`,
      },
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

  private updateChart(): void {
    this.chronologicalStats = this.computeChronologicalStatistics();
    const points: ProxyStatistic[] = this.chronologicalStats;

    if (!points.length) {
      this.chartData = {
        labels: [],
        datasets: [
          {
            data: [],
            borderColor: '#60a5fa',
            backgroundColor: 'rgba(96, 165, 250, 0.15)',
            tension: 0.35,
            fill: true,
            pointRadius: 0,
            borderWidth: 2,
          }
        ]
      };
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
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.15)',
          tension: 0.35,
          fill: true,
          pointRadius: 0,
          pointHitRadius: 8,
          borderWidth: 2,
        }
      ]
    };
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

  private buildDefaultChartOptions(): any {
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
            color: '#cbd5f5'
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.15)'
          }
        },
        y: {
          ticks: {
            color: '#cbd5f5',
            callback: (value: number | string) => `${value} ms`
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)'
          }
        }
      }
    };
  }
}
