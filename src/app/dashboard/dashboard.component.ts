import {HlmSkeleton} from '@spartan-ng/helm/skeleton';
import {HlmButton} from '@spartan-ng/helm/button';
import {PageLoadErrorComponent} from '../shared/page-load-error/page-load-error.component';
import {Component, Inject, LOCALE_ID, OnDestroy, OnInit, signal} from '@angular/core';
import {Subject, Subscription, interval, timer} from 'rxjs';
import {finalize, takeUntil} from 'rxjs/operators';
import {ProxyCheck} from '../models/ProxyCheck';
import {KpiCardComponent} from './cards/kpi-card/kpi-card.component';
import {ProxiesPerHourCardComponent} from './cards/proxies-per-hour-card/proxies-per-hour-card.component';
import {ProxyHistoryCardComponent} from './cards/proxy-history-card/proxy-history-card.component';
import {ProxiesPerCountryCardComponent} from './cards/proxies-per-country-card/proxies-per-country-card.component';
import {JudgeByPercentageCardComponent} from './cards/judge-by-percentage-card/judge-by-percentage-card.component';
import {
  CountryBreakdownEntry,
  DASHBOARD_BACKEND_UNAVAILABLE_ERROR,
  DashboardSnapshotStatus,
  DashboardView,
  DashboardViewer,
  FastestAliveProxy,
  GraphqlService,
  JudgeValidProxy,
  ProxyHistoryEntry,
  RecentProxyCheck,
  ProxySnapshotEntry,
  ProxySnapshots,
  ReputationBreakdown,
} from '../services/graphql.service';
import {ProxyReputationCardComponent} from './cards/proxy-reputation-card/proxy-reputation-card.component';

import {
  FastestAliveProxiesCardComponent,
  FastestAliveProxyCountryLegend
} from './cards/fastest-alive-proxies-card/fastest-alive-proxies-card.component';
import {formatHostPort} from '../shared/proxy-address';
import {buildInventoryChart, buildLatencyChart, buildReputationChart, CHART_LIMIT_COLOR, CHART_SERIES_COLOR, REPUTATION_COLORS} from './dashboard-charts';
import type {AppChartDefinition} from '../shared/ui/chart.component';

interface SparklineMetric {
  value: number | null;
  history: number[];
  displayValue?: string | null;
  change?: number | null;
}

interface DashboardStatus {
  loading: boolean;
  loaded: boolean;
  error?: string;
  backendUnavailable?: boolean;
}

interface ProxyLineI18n {
  title: string;
  proxiesLabel: string;
  limitLabel: string;
  noDataLabel: string;
  tooltipProxiesLabel: string;
  tooltipGainedLabel: string;
  tooltipLostLabel: string;
  tooltipLimitLabel: string;
}

type FastestAliveSortDirection = 'fastest-right' | 'fastest-left';

/** What the page knows about the snapshot behind the current data. */
export interface DashboardSnapshotState {
  status: DashboardSnapshotStatus;
  rebuilding: boolean;
  checkerSettingsPending: boolean;
  /** The health cards hold the previous result, from earlier checker settings. */
  healthOutdated: boolean;
  collectedAt: Date | null;
  healthCollectedAt: Date | null;
}

/** Live check figures from the usage meter. */
export interface DashboardCheckFigures {
  checksThisMonth: number;
  totalChecks: number;
}

/**
 * While a snapshot is PENDING or rebuilding the page asks again after a
 * jittered delay, for at most the claim cooldown plus the build deadline.
 */
export const DASHBOARD_REREQUEST_WINDOW_MS = 60_000;
/**
 * While the health cards hold results from earlier checker settings, the page
 * keeps asking, more slowly after the first window, until results under the
 * new settings arrive. Applying settings to a large workspace takes minutes.
 */
export const DASHBOARD_OUTDATED_REREQUEST_WINDOW_MS = 30 * 60_000;
const DASHBOARD_REREQUEST_MIN_DELAY_MS = 2_000;
const DASHBOARD_REREQUEST_JITTER_MS = 2_000;
const DASHBOARD_SLOW_REREQUEST_MIN_DELAY_MS = 10_000;
const DASHBOARD_SLOW_REREQUEST_JITTER_MS = 5_000;
const DASHBOARD_AGE_TICK_MS = 30_000;

const FASTEST_ALIVE_SORT_STORAGE_KEY = 'magpie.dashboard.fastestAliveSortDirection';
export const WAIT_FOR_CURRENT_HEALTH_STORAGE_KEY = 'magpie.dashboard.waitForCurrentHealth';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [HlmSkeleton,
    HlmButton,
    PageLoadErrorComponent,
    KpiCardComponent,
    ProxiesPerHourCardComponent,
    ProxyHistoryCardComponent,
    ProxiesPerCountryCardComponent,
    JudgeByPercentageCardComponent,
    ProxyReputationCardComponent,
    FastestAliveProxiesCardComponent,
    ],
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  dashboardInfo = signal<DashboardStatus>({ loading: false, loaded: false });
  snapshot = signal<DashboardSnapshotState | null>(null);
  checkFigures = signal<DashboardCheckFigures | null>(null);
  /**
   * While checker settings apply, hide the previous health results and wait
   * for the new ones instead of showing them. Remembered per browser.
   */
  waitForCurrentHealth = signal(this.loadWaitForCurrentHealth());
  /** The last response, re-rendered when the viewer changes that choice. */
  private lastViewer: DashboardViewer | null = null;
  /** Advances every 30 s so the snapshot age stays current. */
  private readonly clock = signal(Date.now());
  private rerequestSince: number | null = null;
  private rerequest?: Subscription;

  readonly inventoryRange = signal('');
  readonly inventorySummary = signal('');
  conversionRate = signal<SparklineMetric>({ value: 0, history: [] });
  avgOrderValue = signal<SparklineMetric>({ value: 0, history: [] });
  orderQuantity = signal<SparklineMetric>({ value: 0, history: [] });

  inventoryChart = signal<AppChartDefinition>({marks: [], scales: {x: null, y: null}});
  inventoryLimit = signal<number | null>(null);

  majorCountries = signal<Array<{ name: string; value: number; color?: string; percentage: string }>>([]);

  anonymitySummary = signal<{ total: number; change: number } | undefined>(undefined);
  anonymitySegments = signal<Array<{
    name: string;
    count: number;
    change: number;
    share: number;
    barClass: string;
    dotColor: string;
  }>>([]);

  proxyHistory = signal<ProxyCheck[]>([]);

  fastestAliveProxies = signal<FastestAliveProxy[]>([]);
  fastestAliveProxyCount = signal(0);
  latencyChart = signal<AppChartDefinition>({marks: [], scales: {x: null, y: null}});
  fastestAliveCountryLegend = signal<FastestAliveProxyCountryLegend[]>([]);
  fastestAliveSortDirection = signal<FastestAliveSortDirection>(this.loadFastestAliveSortDirection());

  reputationBreakdown = signal<ReputationBreakdown | null>(null);
  reputationChart = signal<AppChartDefinition>({marks: [], scales: {x: null, y: null}});

  readonly proxiesPerHourTitle: string;
  private readonly localeId: string;
  private readonly numberFormatter: Intl.NumberFormat;
  private readonly proxyLineI18n: ProxyLineI18n;

  judgeTrafficData = signal<Record<string, number>>({});

  private readonly destroy$ = new Subject<void>();
  proxyHistoryRefreshing = signal(false);
  readonly kpiSkeletons = Array.from({ length: 3 });
  readonly historySkeletons = Array.from({ length: 6 });
  readonly judgeSkeletons = Array.from({ length: 5 });
  readonly legendSkeletons = Array.from({ length: 7 });
  readonly reputationSkeletons = Array.from({ length: 4 });
  readonly chartLines = Array.from({ length: 5 });

  constructor(
    private graphqlService: GraphqlService,
    @Inject(LOCALE_ID) localeId: string
  ) {
    this.localeId = localeId || 'en-US';
    this.numberFormatter = new Intl.NumberFormat(this.localeId);
    this.proxyLineI18n = this.resolveProxyLineI18n(this.localeId);
    this.proxiesPerHourTitle = this.proxyLineI18n.title;
  }

  ngOnInit(): void {
    this.loadDashboard();
    interval(DASHBOARD_AGE_TICK_MS)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.clock.set(Date.now()));
  }

  ngOnDestroy(): void {
    this.rerequest?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * "Updated 3 min ago" for the data's build time, or null before any build.
   * While previous health results are shown, their own age: "from 3 min ago".
   */
  snapshotAgeLabel(): string | null {
    const snapshot = this.snapshot();
    if (this.showingPreviousHealth() && snapshot?.healthCollectedAt) {
      return `from ${this.relativeAge(snapshot.healthCollectedAt)}`;
    }
    const collectedAt = snapshot?.collectedAt;
    return collectedAt ? `Updated ${this.relativeAge(collectedAt)}` : null;
  }

  private relativeAge(at: Date): string {
    const seconds = Math.max(0, Math.round((this.clock() - at.getTime()) / 1000));
    if (seconds < 60) {
      return 'just now';
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min ago`;
    }
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
  }

  /** The health cards show results from earlier checker settings. */
  showingPreviousHealth(): boolean {
    return !!this.snapshot()?.healthOutdated && !this.waitForCurrentHealth();
  }

  /** Why the health results are not current, or null when they are. */
  healthUpdateLabel(): string | null {
    const snapshot = this.snapshot();
    if (snapshot?.checkerSettingsPending) {
      return 'Applying checker settings';
    }
    return snapshot?.healthOutdated ? 'Building results for the new checker settings' : null;
  }

  /** Short state of the snapshot, or null when it is simply current. */
  snapshotStateLabel(): string | null {
    const snapshot = this.snapshot();
    if (!snapshot) {
      return null;
    }
    if (this.showingPreviousHealth()) {
      return 'Previous results';
    }
    if (snapshot.status === 'PENDING' || snapshot.rebuilding || snapshot.healthOutdated) {
      return 'Updating';
    }
    if (snapshot.status === 'FAILED') {
      return 'Update failed';
    }
    if (snapshot.status === 'STALE') {
      return 'Not current';
    }
    return null;
  }

  formatCount(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : this.numberFormatter.format(value);
  }

  onProxyHistoryRefresh(): void {
    if (this.proxyHistoryRefreshing()) {
      return;
    }

    this.proxyHistoryRefreshing.set(true);

    this.graphqlService
      .fetchDashboardData()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.proxyHistoryRefreshing.set(false);
        })
      )
      .subscribe({
        next: ({viewer}) => {
          this.rerequestSince = null;
          this.applyDashboardData(viewer);
          this.dashboardInfo.update((info) => ({ ...info, error: undefined, backendUnavailable: false }));
        },
        error: (error: Error) => {
          const resolved = this.resolveDashboardError(error, 'Failed to refresh proxy history');
          this.dashboardInfo.update((info) => ({
            ...info,
            error: resolved.message,
            backendUnavailable: resolved.backendUnavailable
          }));
        }
      });
  }

  retryDashboardLoad(): void {
    this.loadDashboard();
  }

  /**
   * Switches between showing the previous health results while checker
   * settings apply and hiding them until the new ones arrive.
   */
  setWaitForCurrentHealth(wait: boolean): void {
    if (wait === this.waitForCurrentHealth()) {
      return;
    }
    this.waitForCurrentHealth.set(wait);
    this.saveWaitForCurrentHealth(wait);
    if (this.lastViewer) {
      this.renderDashboardData(this.lastViewer);
    }
  }

  private loadDashboard(): void {
    this.rerequestSince = null;
    this.dashboardInfo.set({ loading: true, loaded: false, backendUnavailable: false });
    this.graphqlService
      .fetchDashboardData()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ viewer }) => {
          this.applyDashboardData(viewer);
          this.dashboardInfo.set({ loading: false, loaded: true, backendUnavailable: false });
        },
        error: (error: Error) => {
          const resolved = this.resolveDashboardError(error, 'Failed to load dashboard data');
          this.dashboardInfo.set({
            loading: false,
            loaded: false,
            error: resolved.message,
            backendUnavailable: resolved.backendUnavailable
          });
        }
      });
  }

  private resolveDashboardError(error: unknown, fallbackMessage: string): { message: string; backendUnavailable: boolean } {
    if (error instanceof Error && error.message === DASHBOARD_BACKEND_UNAVAILABLE_ERROR) {
      return {
        message: 'Dashboard is temporarily unavailable because the backend service cannot be reached.',
        backendUnavailable: true
      };
    }

    const message = error instanceof Error && error.message ? error.message : fallbackMessage;
    return { message, backendUnavailable: false };
  }

  private applyDashboardData(viewer: DashboardViewer | undefined): void {
    if (!viewer) {
      return;
    }
    this.lastViewer = viewer;
    this.renderDashboardData(viewer);
    this.scheduleRerequest(viewer.dashboardView);
  }

  private renderDashboardData(viewer: DashboardViewer): void {
    const served = viewer.dashboardView;
    this.snapshot.set({
      status: served.status,
      rebuilding: served.rebuilding,
      checkerSettingsPending: served.checkerSettingsPending,
      healthOutdated: served.healthOutdated,
      collectedAt: this.parseDate(served.collectedAt ?? undefined),
      healthCollectedAt: this.parseDate(served.healthCollectedAt ?? undefined)
    });
    // Waiting for current results hides the previous ones as unavailable.
    const view: DashboardView = served.healthOutdated && this.waitForCurrentHealth()
      ? {
        ...served,
        aliveCount: null,
        recentProxyChecks: null,
        fastestAliveProxies: null,
        info: {...served.info, judgeValidProxies: null}
      }
      : served;
    this.clock.set(Date.now());
    this.checkFigures.set({checksThisMonth: view.info.checksThisMonth, totalChecks: view.info.totalChecks});
    this.updateKpis(view, viewer.proxySnapshots, viewer.proxyHistory);
    this.updateCountryBreakdown(view.info.countryBreakdown ?? []);
    this.updateReputationOverview(view);
    this.updateProxyHistory(view.recentProxyChecks ?? []);
    this.updateFastestAliveScatter(view.fastestAliveProxies ?? []);
    this.updateAnonymitySummary(view.info.judgeValidProxies ?? []);
    this.updateJudgeBreakdown(view.info.judgeValidProxies ?? []);
    this.buildProxiesLineChart(viewer.proxyHistory ?? [], viewer.proxyLimit);
  }

  /**
   * Asks again after a jittered delay while the snapshot is being built or its
   * health results are from earlier checker settings, so the page fills in
   * once a build publishes. Each re-request is an ordinary read; the backend
   * claims a build only when the row is eligible.
   */
  private scheduleRerequest(view: DashboardView): void {
    this.rerequest?.unsubscribe();
    this.rerequest = undefined;
    if (view.status !== 'PENDING' && !view.rebuilding && !view.healthOutdated) {
      this.rerequestSince = null;
      return;
    }
    const now = Date.now();
    this.rerequestSince ??= now;
    const since = this.rerequestSince;
    const windowMs = view.healthOutdated ? DASHBOARD_OUTDATED_REREQUEST_WINDOW_MS : DASHBOARD_REREQUEST_WINDOW_MS;
    const delay = now - since < DASHBOARD_REREQUEST_WINDOW_MS
      ? DASHBOARD_REREQUEST_MIN_DELAY_MS + Math.random() * DASHBOARD_REREQUEST_JITTER_MS
      : DASHBOARD_SLOW_REREQUEST_MIN_DELAY_MS + Math.random() * DASHBOARD_SLOW_REREQUEST_JITTER_MS;
    // Never send a re-request after the window, wherever the delay lands.
    if (now + delay - since > windowMs) {
      return;
    }
    this.rerequest = timer(delay)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (Date.now() - since > windowMs) {
          return;
        }
        this.graphqlService
          .fetchDashboardData()
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: ({viewer}) => this.applyDashboardData(viewer),
            // Keep the data already shown; the next manual refresh retries.
            error: () => undefined
          });
      });
  }

  private updateKpis(
    view: DashboardView,
    snapshots: ProxySnapshots | undefined,
    proxyHistory: ProxyHistoryEntry[] | undefined
  ): void {
    // The current alive count is the snapshot's count only. Before any health
    // is built, or while the viewer waits for current results, it is null,
    // and the last history sample must not stand in for it. The backend
    // appends the snapshot's count as the series' last point, stamped with
    // its collection time, unless a newer sample exists; the trend excludes
    // that point when it was appended.
    const aliveSeries = this.extractSnapshotCounts(snapshots?.alive);
    const aliveValue = view.aliveCount;
    const lastAlive = snapshots?.alive?.[snapshots.alive.length - 1];
    const healthCollectedAt = this.parseDate(view.healthCollectedAt ?? undefined);
    const appended = aliveValue !== null && !!lastAlive && !!healthCollectedAt
      && this.parseDate(lastAlive.recordedAt)?.getTime() === healthCollectedAt.getTime();

    this.conversionRate.set({
      value: aliveValue,
      history: appended ? aliveSeries.slice(0, -1) : aliveSeries,
      displayValue: this.formatCount(aliveValue)
    });

    const totalSeries = (proxyHistory ?? []).map((entry) => entry.count);
    this.avgOrderValue.set({
      value: view.proxyCount,
      history: totalSeries,
      displayValue: this.formatCount(view.proxyCount)
    });

    const scrapedSeries = this.extractSnapshotCounts(snapshots?.scraped);
    const scrapedValue = scrapedSeries.length ? scrapedSeries[scrapedSeries.length - 1] : view.info.totalScraped;

    this.orderQuantity.set({
      value: scrapedValue,
      history: scrapedSeries.slice(0, -1),
      displayValue: this.formatCount(scrapedValue)
    });
  }

  private extractSnapshotCounts(entries: ProxySnapshotEntry[] | undefined): number[] {
    if (!Array.isArray(entries) || !entries.length) {
      return [];
    }

    return entries
      .map((entry) => Number(entry?.count ?? 0))
      .filter((value) => Number.isFinite(value) && value >= 0);
  }

  private updateCountryBreakdown(breakdown: CountryBreakdownEntry[] = []): void {
    const aggregated = new Map<string, number>();

    breakdown
      .filter((entry) => entry.count > 0)
      .forEach((entry) => {
        const name = this.normalizeCountryBreakdownName(entry.country);
        aggregated.set(name, (aggregated.get(name) ?? 0) + entry.count);
      });

    const sorted = Array.from(aggregated, ([name, value]) => ({name, value}))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = sorted.reduce((sum, entry) => sum + entry.value, 0);

    this.majorCountries.set(sorted.map((entry) => ({
      name: entry.name,
      value: entry.value,
      percentage: total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0'
    })));
  }

  private normalizeCountryBreakdownName(country: string | undefined | null): string {
    const trimmed = country?.trim() ?? '';
    if (!trimmed) {
      return 'Unknown';
    }

    switch (trimmed.toLowerCase()) {
      case 'n/a':
      case 'unknown':
      case 'unk':
        return 'Unknown';
      default:
        return trimmed;
    }
  }

  private updateProxyHistory(proxies: RecentProxyCheck[]): void {
    this.proxyHistory.set(
      proxies
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
            ip: formatHostPort(proxy.ip, proxy.port),
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
        .slice(0, 8)
    );
  }

  private updateFastestAliveScatter(proxies: FastestAliveProxy[]): void {
    this.fastestAliveProxies.set(proxies);

    const prepared = proxies
      .filter((proxy) => Number.isFinite(proxy.responseTime) && proxy.responseTime >= 0)
      .map((proxy, index) => {
        const country = this.normalizeCountryBreakdownName(proxy.country);
        const reputation = this.normalizeReputationLabel(proxy.reputationLabel);
        const reputationScore = Number.isFinite(proxy.reputationScore)
          ? Math.max(0, Math.min(100, proxy.reputationScore))
          : 0;
        return {
          rank: index + 1,
          proxy: formatHostPort(proxy.ip, proxy.port),
          responseTime: proxy.responseTime,
          country,
          reputation,
          reputationScore,
          latestCheck: proxy.latestCheck
        };
      });

    this.fastestAliveProxyCount.set(prepared.length);

    const countryStats = prepared.reduce((acc, point) => {
      const values = acc.get(point.country) ?? [];
      values.push(point.responseTime);
      acc.set(point.country, values);
      return acc;
    }, new Map<string, number[]>());

    const countryOrder = Array.from(countryStats, ([country, values]) => ({
      country,
      count: values.length,
      medianLatency: this.median(values)
    })).sort((a, b) => this.compareFastestAliveCountries(a, b));

    const countryIndex = new Map(countryOrder.map((entry, index) => [entry.country, index + 1]));
    const points = prepared.map((point) => {
      const bucket = countryIndex.get(point.country) ?? 1;
      return {
        x: bucket + this.stableJitter(point.proxy),
        y: point.responseTime,
        rank: point.rank,
        proxy: point.proxy,
        country: point.country,
        reputation: point.reputation,
        reputationScore: point.reputationScore,
        latestCheck: point.latestCheck
      };
    });

    const countryLegend = countryOrder.map((entry) => ({
      country: entry.country,
      count: entry.count
    }));

    this.fastestAliveCountryLegend.set(countryLegend);

    this.latencyChart.set(buildLatencyChart(
      points,
      countryLegend.map(entry => entry.country),
      value => this.numberFormatter.format(value),
    ));
  }

  onFastestAliveSortDirectionChange(direction: FastestAliveSortDirection): void {
    if (direction === this.fastestAliveSortDirection()) {
      return;
    }

    this.fastestAliveSortDirection.set(direction);
    this.saveFastestAliveSortDirection(direction);
    this.updateFastestAliveScatter(this.fastestAliveProxies());
  }

  private compareFastestAliveCountries(
    a: { country: string; count: number; medianLatency: number },
    b: { country: string; count: number; medianLatency: number }
  ): number {
    const latencySort = this.fastestAliveSortDirection() === 'fastest-right'
      ? b.medianLatency - a.medianLatency
      : a.medianLatency - b.medianLatency;

    return latencySort || b.count - a.count || a.country.localeCompare(b.country);
  }

  private median(values: number[]): number {
    if (!values.length) {
      return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const midpoint = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
    }
    return sorted[midpoint];
  }

  private stableJitter(seed: string): number {
    let hash = 0;
    for (let index = 0; index < seed.length; index++) {
      hash = ((hash * 31) + seed.charCodeAt(index)) >>> 0;
    }
    return ((hash % 1000) / 1000 - 0.5) * 0.62;
  }

  private loadFastestAliveSortDirection(): FastestAliveSortDirection {
    const storage = this.getStorage();
    if (!storage) {
      return 'fastest-right';
    }

    try {
      const stored = storage.getItem(FASTEST_ALIVE_SORT_STORAGE_KEY);
      return stored === 'fastest-left' || stored === 'fastest-right' ? stored : 'fastest-right';
    } catch {
      return 'fastest-right';
    }
  }

  private saveFastestAliveSortDirection(direction: FastestAliveSortDirection): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    try {
      storage.setItem(FASTEST_ALIVE_SORT_STORAGE_KEY, direction);
    } catch {
      // Ignore storage access failures and keep the in-memory selection.
    }
  }

  private loadWaitForCurrentHealth(): boolean {
    try {
      return this.getStorage()?.getItem(WAIT_FOR_CURRENT_HEALTH_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private saveWaitForCurrentHealth(wait: boolean): void {
    try {
      this.getStorage()?.setItem(WAIT_FOR_CURRENT_HEALTH_STORAGE_KEY, String(wait));
    } catch {
      // Ignore storage access failures and keep the in-memory choice.
    }
  }

  private getStorage(): Storage | null {
    if (typeof window === 'undefined' || !window?.localStorage) {
      return null;
    }

    return window.localStorage;
  }

  private normalizeReputationLabel(label: string | undefined | null): string {
    const normalized = (label ?? '').trim().toLowerCase();
    if (normalized === 'good' || normalized === 'neutral') {
      return normalized;
    }
    if (normalized === 'poor' || normalized === 'bad') {
      return 'bad';
    }
    return 'unknown';
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

    this.anonymitySummary.set({ total, change: 0 });
    this.anonymitySegments.set(
      segmentConfig.map((config) => {
        const count = totals[config.key];
        return {
          name: config.name,
          count,
          change: 0,
          share: total > 0 ? count / total : 0,
          barClass: config.barClass,
          dotColor: config.dotColor
        };
      })
    );
  }

  private updateJudgeBreakdown(entries: JudgeValidProxy[]): void {
    const data: Record<string, number> = {};
    entries.forEach((entry) => {
      const total = entry.eliteProxies + entry.anonymousProxies + entry.transparentProxies;
      if (total > 0) {
        data[entry.judgeUrl] = total;
      }
    });

    this.judgeTrafficData.set(data);
  }

  private updateReputationOverview(view: DashboardView): void {
    const breakdown = view.info.reputationBreakdown;
    this.reputationBreakdown.set(breakdown);
    if (!breakdown) {
      return;
    }

    const values = [breakdown.good, breakdown.neutral, breakdown.poor, breakdown.unknown];
    const labels = ['Good', 'Neutral', 'Poor', 'Unknown'];
    this.reputationChart.set(buildReputationChart(
      labels.map((label, index) => ({label, value: values[index], color: REPUTATION_COLORS[index]})),
      value => this.numberFormatter.format(value),
      this.localeId,
    ));
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

    const labelFormatter = new Intl.DateTimeFormat(this.localeId, {dateStyle: 'medium', timeStyle: 'short'});
    const dayFormatter = new Intl.DateTimeFormat(this.localeId, {day: '2-digit', month: '2-digit'});

    const entries = parsed.length ? parsed : [{timestamp: null, count: 0}];
    const points = entries.map((entry, index) => {
      const delta = index === 0 ? entry.count : entry.count - entries[index - 1].count;
      return {
        index,
        label: entry.timestamp ? labelFormatter.format(entry.timestamp) : this.proxyLineI18n.noDataLabel,
        axisLabel: entry.timestamp ? dayFormatter.format(entry.timestamp) : undefined,
        count: entry.count,
        gained: Math.max(delta, 0),
        lost: Math.max(-delta, 0),
      };
    });
    this.inventoryLimit.set(effectiveLimit);
    this.updateInventoryCaption(parsed);
    this.inventoryChart.set(buildInventoryChart(points, effectiveLimit, this.proxyLineI18n, value => this.numberFormatter.format(value)));
  }

  private updateInventoryCaption(entries: Array<{timestamp: Date; count: number}>): void {
    if (!entries.length) {
      this.inventoryRange.set('');
      this.inventorySummary.set('No inventory history has been recorded yet.');
      return;
    }
    const day = new Intl.DateTimeFormat(this.localeId, {day: '2-digit', month: '2-digit'});
    const first = entries[0];
    const last = entries[entries.length - 1];
    const from = day.format(first.timestamp);
    const to = day.format(last.timestamp);
    this.inventoryRange.set(from === to ? from : `${from} – ${to}`);
    const peak = Math.max(...entries.map(entry => entry.count));
    this.inventorySummary.set(
      `Active proxies (not paused or archived) went from ${this.numberFormatter.format(first.count)} on ${from} to ` +
      `${this.numberFormatter.format(last.count)} on ${to}, peaking at ${this.numberFormatter.format(peak)}.`,
    );
  }

  get inventoryLegend(): Array<{label: string; color: string; dashed?: boolean}> {
    return [
      {label: this.proxyLineI18n.proxiesLabel, color: CHART_SERIES_COLOR},
      ...(this.inventoryLimit() === null ? [] : [{label: this.proxyLineI18n.limitLabel, color: CHART_LIMIT_COLOR, dashed: true}]),
    ];
  }

  private parseDate(raw?: string): Date | null {
    if (!raw) {
      return null;
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toTimeLabel(date: Date): string {
    return new Intl.DateTimeFormat(this.localeId, {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }



  private resolveProxyLineI18n(_localeId: string): ProxyLineI18n {
    return {
      title: 'Proxy inventory',
      proxiesLabel: 'Proxies',
      limitLabel: 'Proxy limit',
      noDataLabel: 'No data',
      tooltipProxiesLabel: 'Proxies',
      tooltipGainedLabel: 'Gained',
      tooltipLostLabel: 'Lost',
      tooltipLimitLabel: 'Limit'
    };
  }
}
