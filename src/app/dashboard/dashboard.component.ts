import {Component, OnDestroy, OnInit} from '@angular/core';
import {DecimalPipe} from '@angular/common';
import {Subject} from 'rxjs';
import {finalize, takeUntil} from 'rxjs/operators';
import {ProxyCheck} from '../models/ProxyCheck';
import {KpiCardComponent} from './cards/kpi-card/kpi-card.component';
import {ProxiesPerHourCardComponent} from './cards/proxies-per-hour-card/proxies-per-hour-card.component';
import {ProxyHistoryCardComponent} from './cards/proxy-history-card/proxy-history-card.component';
import {ProxiesPerCountryCardComponent} from './cards/proxies-per-country-card/proxies-per-country-card.component';
import {JudgeByPercentageCardComponent} from './cards/judge-by-percentage-card/judge-by-percentage-card.component';
import {
  CountryBreakdownEntry,
  DashboardInfo,
  DashboardViewer,
  GraphqlService,
  JudgeValidProxy,
  ProxyHistoryEntry,
  ProxyNode,
  ProxySnapshotEntry,
  ProxySnapshots,
  ReputationBreakdown,
} from '../services/graphql.service';
import {LoadingComponent} from '../ui-elements/loading/loading.component';
import {ProxyReputationCardComponent} from './cards/proxy-reputation-card/proxy-reputation-card.component';

interface SparklineMetric {
  value: number;
  history: number[];
  displayValue?: string | null;
  change?: number | null;
}

interface DashboardStatus {
  loading: boolean;
  loaded: boolean;
  error?: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [
    DecimalPipe,
    KpiCardComponent,
    ProxiesPerHourCardComponent,
    ProxyHistoryCardComponent,
    ProxiesPerCountryCardComponent,
    JudgeByPercentageCardComponent,
    LoadingComponent,
    ProxyReputationCardComponent
  ],
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  dashboardInfo: DashboardStatus = { loading: false, loaded: false };

  conversionRate: SparklineMetric = { value: 0, history: [] };
  avgOrderValue: SparklineMetric = { value: 0, history: [] };
  orderQuantity: SparklineMetric = { value: 0, history: [] };

  proxiesLineData: any = {};
  proxiesLineOptions: any = {};
  private proxiesLineDiff = { gained: [] as number[], lost: [] as number[] };

  majorCountries: Array<{ name: string; value: number; color?: string; percentage: string }> = [];

  anonymitySummary?: { total: number; change: number };
  anonymitySegments: Array<{
    name: string;
    count: number;
    change: number;
    share: number;
    barClass: string;
    dotColor: string;
  }> = [];

  proxyHistory: ProxyCheck[] = [];

  visitorPieData = {
    labels: [] as string[],
    datasets: [
      {
        data: [] as number[],
        backgroundColor: [] as string[],
        hoverBackgroundColor: [] as string[]
      }
    ]
  };

  reputationBreakdown: ReputationBreakdown = { good: 0, neutral: 0, poor: 0, unknown: 0 };
  reputationChartData: any = {};
  reputationChartOptions: any = {};

  private readonly numberFormatter = new Intl.NumberFormat('de-DE');

  pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#e5e7eb'
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context?.label ?? '';
            const value = typeof context?.parsed === 'number' ? context.parsed : 0;
            const formatted = this.numberFormatter.format(value);
            return label ? `${label}: ${formatted}` : formatted;
          }
        }
      }
    }
  };

  judgeTrafficData: Record<string, number> = {};
  judgePeriodOptions = ['Yearly', 'Monthly', 'Weekly'];

  private readonly destroy$ = new Subject<void>();
  proxyHistoryRefreshing = false;

  constructor(private graphqlService: GraphqlService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onProxyHistoryRefresh(): void {
    if (this.proxyHistoryRefreshing) {
      return;
    }

    this.proxyHistoryRefreshing = true;

    this.graphqlService
      .fetchDashboardData()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.proxyHistoryRefreshing = false;
        })
      )
      .subscribe({
        next: ({viewer}) => {
          this.applyDashboardData(viewer);
          this.dashboardInfo = {...this.dashboardInfo, error: undefined};
        },
        error: (error: Error) => {
          this.dashboardInfo = {
            ...this.dashboardInfo,
            error: error?.message ?? 'Failed to refresh proxy history'
          };
        }
      });
  }

  private loadDashboard(): void {
    this.dashboardInfo = { loading: true, loaded: false };
    this.graphqlService
      .fetchDashboardData()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ viewer }) => {
          this.applyDashboardData(viewer);
          this.dashboardInfo = { loading: false, loaded: true };
        },
        error: (error: Error) => {
          this.dashboardInfo = {
            loading: false,
            loaded: false,
            error: error?.message ?? 'Failed to load dashboard data'
          };
        }
      });
  }

  private applyDashboardData(viewer: DashboardViewer | undefined): void {
    if (!viewer) {
      return;
    }

    this.updateKpis(viewer.dashboard, viewer.proxyCount, viewer.proxySnapshots, viewer.proxyHistory);
    this.updateCountryBreakdown(
      viewer.proxies?.items ?? [],
      viewer.proxyCount,
      viewer.dashboard?.countryBreakdown ?? []
    );
    this.updateReputationOverview(viewer.dashboard);
    this.updateProxyHistory(viewer.proxies?.items ?? []);
    this.updateAnonymitySummary(viewer.dashboard?.judgeValidProxies ?? []);
    this.updateJudgeBreakdown(viewer.dashboard?.judgeValidProxies ?? []);
    this.buildProxiesLineChart(viewer.proxyHistory ?? [], viewer.proxyLimit);
  }

  private updateKpis(
    dashboard: DashboardInfo | undefined,
    proxyCount: number,
    snapshots: ProxySnapshots | undefined,
    proxyHistory: ProxyHistoryEntry[] | undefined
  ): void {
    const aliveSeries = this.extractSnapshotCounts(snapshots?.alive);
    const fallbackAlive = this.resolveAliveFallback(dashboard);
    const aliveValue = aliveSeries.length ? aliveSeries[aliveSeries.length - 1] : fallbackAlive.value;
    const aliveHistory = aliveSeries.length ? aliveSeries : fallbackAlive.history;

    this.conversionRate = {
      value: aliveValue,
      history: aliveHistory.length ? aliveHistory : [aliveValue],
      displayValue: aliveValue.toLocaleString()
    };

    const totalSeries = (proxyHistory ?? []).map((entry) => entry.count);
    this.avgOrderValue = {
      value: proxyCount,
      history: totalSeries.length ? totalSeries : [proxyCount],
      displayValue: proxyCount.toLocaleString()
    };

    const scrapedSeries = this.extractSnapshotCounts(snapshots?.scraped);
    const fallbackScraped = this.resolveScrapedFallback(dashboard);
    const scrapedValue = scrapedSeries.length ? scrapedSeries[scrapedSeries.length - 1] : fallbackScraped.value;
    const scrapedHistory = scrapedSeries.length ? scrapedSeries : fallbackScraped.history;

    this.orderQuantity = {
      value: scrapedValue,
      history: scrapedHistory.length ? scrapedHistory : [scrapedValue],
      displayValue: scrapedValue.toLocaleString()
    };
  }

  private extractSnapshotCounts(entries: ProxySnapshotEntry[] | undefined): number[] {
    if (!Array.isArray(entries) || !entries.length) {
      return [];
    }

    return entries
      .map((entry) => Number(entry?.count ?? 0))
      .filter((value) => Number.isFinite(value) && value >= 0);
  }

  private resolveAliveFallback(dashboard: DashboardInfo | undefined): { value: number; history: number[] } {
    const judgeEntries = dashboard?.judgeValidProxies ?? [];
    if (!judgeEntries.length) {
      return { value: 0, history: [] };
    }

    const totals = judgeEntries.map(
      (entry) => entry.eliteProxies + entry.anonymousProxies + entry.transparentProxies
    );
    const aggregate = totals.reduce((sum, value) => sum + value, 0);

    return {
      value: aggregate,
      history: totals.filter((value) => value > 0)
    };
  }

  private resolveScrapedFallback(dashboard: DashboardInfo | undefined): { value: number; history: number[] } {
    if (!dashboard) {
      return { value: 0, history: [] };
    }

    const totalScraped = dashboard.totalScraped ?? 0;
    const totalScrapedWeek = dashboard.totalScrapedWeek ?? 0;
    const history = totalScrapedWeek > 0 ? [totalScrapedWeek] : [];

    return {
      value: totalScraped,
      history
    };
  }

  private updateCountryBreakdown(
    proxies: ProxyNode[],
    proxyTotal: number,
    breakdown: CountryBreakdownEntry[] = []
  ): void {
    const aggregated = breakdown.length
      ? breakdown
        .filter((entry) => entry.count > 0)
        .map((entry) => ({
          name: entry.country?.trim() || 'Unknown',
          value: entry.count
        }))
      : this.buildCountryCountsFromProxies(proxies);

    const sorted = aggregated.sort((a, b) => b.value - a.value);
    const total = sorted.reduce((sum, entry) => sum + entry.value, 0);

    const primaryEntries = sorted.slice(0, 10);
    const othersValue = sorted.slice(4).reduce((sum, entry) => sum + entry.value, 0);
    if (othersValue > 0) {
      primaryEntries.push({ name: 'Others', value: othersValue });
    }

    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1', '#34d399'];

    this.majorCountries = primaryEntries.map((entry, index) => ({
      name: entry.name,
      value: entry.value,
      color: palette[index % palette.length],
      percentage: total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0'
    }));

    const labels = this.majorCountries.map((entry) => entry.name);
    const data = this.majorCountries.map((entry) => entry.value);
    const backgroundColors = this.majorCountries.map((entry, index) =>
      entry.color ?? palette[index % palette.length]
    );
    const hoverColors = backgroundColors.map((color) => this.adjustColor(color, 25));

    this.visitorPieData = {
      labels,
      datasets: [
        {
          data,
          backgroundColor: backgroundColors,
          hoverBackgroundColor: hoverColors
        }
      ]
    };

    if (!labels.length && proxyTotal > 0) {
      this.visitorPieData.labels = ['Total'];
      this.visitorPieData.datasets[0].data = [proxyTotal];
      this.visitorPieData.datasets[0].backgroundColor = ['#3b82f6'];
      this.visitorPieData.datasets[0].hoverBackgroundColor = ['#60a5fa'];
    }
  }

  private buildCountryCountsFromProxies(proxies: ProxyNode[]): Array<{ name: string; value: number }> {
    const counts = new Map<string, number>();
    proxies.forEach((proxy) => {
      const key = proxy.country?.trim() || 'Unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }

  private updateProxyHistory(proxies: ProxyNode[]): void {
    this.proxyHistory = proxies
      .map((proxy): ProxyCheck | null => {
        const latest = this.parseDate(proxy.latestCheck);
        if (!latest) {
          return null;
        }

        const status = proxy.alive
          ? 'working'
          : proxy.responseTime === 0
            ? 'timeout'
            : 'failed';

        const entry: ProxyCheck = {
          id: `#${proxy.id}`,
          ip: `${proxy.ip}:${proxy.port}`,
          status,
          date: latest,
          time: this.toTimeLabel(latest)
        };

        if (proxy.responseTime > 0) {
          entry.latency = proxy.responseTime;
        }

        return entry;
      })
      .filter((entry): entry is ProxyCheck => entry !== null)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 8);
  }

  private updateAnonymitySummary(entries: JudgeValidProxy[]): void {
    const totals = entries.reduce(
      (acc, entry) => {
        acc.elite += entry.eliteProxies;
        acc.anonymous += entry.anonymousProxies;
        acc.transparent += entry.transparentProxies;
        return acc;
      },
      { elite: 0, anonymous: 0, transparent: 0 }
    );

    const total = totals.elite + totals.anonymous + totals.transparent;
    this.anonymitySummary = { total, change: 0 };

    const segmentConfig: Array<{
      key: keyof typeof totals;
      name: string;
      barClass: string;
      dotColor: string;
    }> = [
      { key: 'elite', name: 'Elite', barClass: 'bg-blue-500/70', dotColor: '#60a5fa' },
      { key: 'anonymous', name: 'Anonymous', barClass: 'bg-orange-500/70', dotColor: '#f59e0b' },
      { key: 'transparent', name: 'Transparent', barClass: 'bg-slate-300/70', dotColor: '#cbd5e1' }
    ];

    this.anonymitySegments = segmentConfig.map((config) => {
      const count = totals[config.key];
      return {
        name: config.name,
        count,
        change: 0,
        share: total > 0 ? count / total : 0,
        barClass: config.barClass,
        dotColor: config.dotColor
      };
    });
  }

  private updateJudgeBreakdown(entries: JudgeValidProxy[]): void {
    const data: Record<string, number> = {};
    entries.forEach((entry) => {
      const total = entry.eliteProxies + entry.anonymousProxies + entry.transparentProxies;
      if (total > 0) {
        data[entry.judgeUrl] = total;
      }
    });

    this.judgeTrafficData = data;
  }

  private updateReputationOverview(dashboard: DashboardInfo | undefined): void {
    const source = dashboard?.reputationBreakdown;
    const breakdown: ReputationBreakdown = {
      good: source?.good ?? 0,
      neutral: source?.neutral ?? 0,
      poor: source?.poor ?? 0,
      unknown: source?.unknown ?? 0
    };

    this.reputationBreakdown = breakdown;

    const values = [breakdown.good, breakdown.neutral, breakdown.poor, breakdown.unknown];
    const labels = ['Good', 'Neutral', 'Poor', 'Unknown'];
    const accentColors = ['#22c55e', '#f97316', '#ef4444', '#94a3b8'];
    const stemColors = [
      'rgba(34, 197, 94, 0.35)',
      'rgba(249, 115, 22, 0.35)',
      'rgba(239, 68, 68, 0.35)',
      'rgba(148, 163, 184, 0.35)'
    ];

    const lollipopPoints = labels.map((label, index) => ({
      x: values[index],
      y: label
    }));

    this.reputationChartData = {
      labels,
      datasets: [
        {
          type: 'bar',
          data: values,
          backgroundColor: stemColors,
          borderColor: accentColors,
          borderWidth: 1.25,
          borderRadius: 999,
          borderSkipped: false,
          barThickness: 8,
          maxBarThickness: 12,
          minBarLength: 2,
          hoverBackgroundColor: stemColors,
          hoverBorderColor: accentColors
        },
        {
          type: 'scatter',
          data: lollipopPoints,
          backgroundColor: accentColors,
          borderColor: '#0f172a',
          borderWidth: 2,
          pointRadius: 9,
          pointHoverRadius: 11,
          hitRadius: 24,
          clip: false
        }
      ]
    };

    const total = values.reduce((sum, value) => sum + value, 0);

    this.reputationChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 650 },
      indexAxis: 'y',
      layout: {
        padding: { left: 8, right: 16, top: 8, bottom: 8 }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111827',
          titleColor: '#f9fafb',
          bodyColor: '#e5e7eb',
          borderColor: '#1f2937',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (context: any) => {
              const label = context?.label ?? '';
              const rawValue = context?.raw;
              const parsedValue = context?.parsed;

              let value = 0;
              if (typeof rawValue === 'number') {
                value = rawValue;
              } else if (rawValue && typeof rawValue.x === 'number') {
                value = rawValue.x;
              } else if (typeof parsedValue === 'number') {
                value = parsedValue;
              } else if (parsedValue && typeof parsedValue.x === 'number') {
                value = parsedValue.x;
              } else if (parsedValue && typeof parsedValue.r === 'number') {
                value = parsedValue.r;
              }

              const chartData = context?.chart?.data;
              const datasetIndex = typeof context?.datasetIndex === 'number' ? context.datasetIndex : 0;
              const dataset = chartData?.datasets?.[datasetIndex];
              const dataPoints = Array.isArray(dataset?.data) ? dataset.data : [];

              const datasetTotal = dataPoints.reduce((sum: number, entry: unknown) => {
                return typeof entry === 'number' ? sum + entry : sum;
              }, 0);

              const effectiveTotal = datasetTotal > 0 ? datasetTotal : total;
              const share = effectiveTotal > 0 ? ((value / effectiveTotal) * 100).toFixed(1) : '0.0';
              const formatted = this.numberFormatter.format(value);
              return `${label}: ${formatted} (${share}%)`;
            }
          }
        }
      },
      elements: {
        bar: {
          borderRadius: 999,
          borderSkipped: false
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: '#1f2937'
          },
          ticks: {
            color: '#d1d5db',
            callback: (value: string | number) => {
              if (typeof value === 'number') {
                return this.numberFormatter.format(value);
              }
              const parsed = Number(value);
              return Number.isNaN(parsed) ? value : this.numberFormatter.format(parsed);
            }
          },
          border: {
            color: '#1f2937'
          }
        },
        y: {
          type: 'category',
          grid: {
            display: false
          },
          ticks: {
            color: '#94a3b8',
            font: {
              weight: '600'
            }
          }
        }
      }
    };
  }

  private buildProxiesLineChart(history: ProxyHistoryEntry[], limit: number | null | undefined): void {
    const parsed = history
      .map((entry) => {
        const timestamp = this.parseDate(entry.recordedAt);
        if (!timestamp) {
          return null;
        }
        return { timestamp, count: entry.count ?? 0 };
      })
      .filter((entry): entry is { timestamp: Date; count: number } => entry !== null)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const effectiveLimit = typeof limit === 'number' && Number.isFinite(limit) && limit >= 0 ? limit : null;

    const labelFormatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (!parsed.length) {
      this.proxiesLineDiff = { gained: [0], lost: [0] };
      const diffRef = this.proxiesLineDiff;
      const datasets: Array<Record<string, unknown>> = [
        {
          label: 'Proxies',
          data: [0],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ];

      if (effectiveLimit !== null) {
        datasets.push({
          label: 'Proxy Limit',
          data: [effectiveLimit],
          borderColor: '#f59e0b',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        });
      }

      this.proxiesLineData = {
        labels: ['No Data'],
        datasets
      };
      this.proxiesLineOptions = this.createProxyLineOptions(diffRef);
      return;
    }

    const labels = parsed.map((entry) => labelFormatter.format(entry.timestamp));
    const values = parsed.map((entry) => entry.count);

    const gained = values.map((value, index) => (index === 0 ? value : value - values[index - 1]));
    const lost = gained.map((value) => (value < 0 ? Math.abs(value) : 0));
    this.proxiesLineDiff = { gained, lost };

    const datasets: Array<Record<string, unknown>> = [
      {
        label: 'Proxies',
        data: values,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ];

    if (effectiveLimit !== null) {
      datasets.push({
        label: 'Proxy Limit',
        data: values.map(() => effectiveLimit),
        borderColor: '#f59e0b',
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
      });
    }

    const diffRef = this.proxiesLineDiff;

    this.proxiesLineData = {
      labels,
      datasets
    };

    this.proxiesLineOptions = this.createProxyLineOptions(diffRef);
  }

  private createProxyLineOptions(diffRef: { gained: number[]; lost: number[] }) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const index = context.dataIndex;
              const value = context.dataset.data[index];
              if (context.dataset.label === 'Proxies') {
                const gainedValue = diffRef.gained[index] ?? 0;
                const lostValue = diffRef.lost[index] ?? 0;
                return `Proxies: ${value} (Gained: ${Math.max(gainedValue, 0)}, Lost: ${lostValue})`;
              }
              return `Limit: ${value}`;
            }
          }
        },
        legend: {
          labels: { color: '#e5e7eb' }
        }
      },
      scales: {
        x: {
          ticks: { color: '#9ca3af' },
          grid: { color: '#374151' }
        },
        y: {
          ticks: { color: '#9ca3af' },
          grid: { color: '#374151' }
        }
      }
    };
  }

  private parseDate(raw?: string): Date | null {
    if (!raw) {
      return null;
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toTimeLabel(date: Date): string {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  private adjustColor(hex: string, amount: number): string {
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) {
      return hex;
    }

    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);

    const clamp = (channel: number) => Math.max(0, Math.min(255, channel + amount));

    const nr = clamp(r);
    const ng = clamp(g);
    const nb = clamp(b);

    const toHex = (value: number) => value.toString(16).padStart(2, '0');
    return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
  }
}
