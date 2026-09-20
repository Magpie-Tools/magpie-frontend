import {HlmTooltip} from '@spartan-ng/helm/tooltip';
import {InventoryPageShellComponent} from '../../shared/inventory-page-shell/inventory-page-shell.component';
import {HlmPopoverImports} from '@spartan-ng/helm/popover';
import {TablePageEvent} from '../../shared/ui/pagination.component';
import {loadProxyFilterOptions} from '../../shared/proxy-filter-options';
import {SourceFetchModeComponent} from '../source-fetch-mode/source-fetch-mode.component';
import {SourceScrapeStatusComponent} from '../source-scrape-status/source-scrape-status.component';
import {Component, OnDestroy, OnInit, signal} from '@angular/core';
import { CommonModule, DatePipe, NgClass } from '@angular/common';
import {FormBuilder, FormGroup} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {Subscription} from 'rxjs';
import {ScrapeSourceDetail} from '../../models/ScrapeSourceDetail';
import {HttpService} from '../../services/http.service';
import {ClipboardService} from '../../services/clipboard.service';
import {NotificationService} from '../../services/notification-service.service';
import {LoadingComponent} from '../../ui-elements/loading/loading.component';
import {ProxyInfo} from '../../models/ProxyInfo';

import {ProxyListFilters} from '../../models/ProxyListFilters';
import {ProxyFilterOptions} from '../../models/ProxyFilterOptions';
import {ProxyFilterPanelComponent} from '../../shared/proxy-filter-panel/proxy-filter-panel.component';
import {ProxyTableComponent} from '../../shared/proxy-table/proxy-table.component';
import {
  DEFAULT_PROXY_TABLE_COLUMNS,
  PROXY_TABLE_COLUMN_DEFINITIONS,
  ProxyTableColumnId,
  normalizeProxyTableColumns,
} from '../../shared/proxy-table/proxy-table-columns';
import {SettingsService} from '../../services/settings.service';
import {UserSettings} from '../../models/UserSettings';
import {ColumnPickerPanelComponent} from '../../shared/column-picker-panel/column-picker-panel.component';
import {
  ProxyFilterOption,
  ProxyListAppliedFilters,
  ProxyListFilterFormValues,
  PROXY_REPUTATION_OPTIONS,
  PROXY_STATUS_OPTIONS,
  activeProxyFilterCount,
  buildFiltersFromFormValue,
  buildProxyListFilterPayload,
  createDefaultProxyFilterValues,
  createProxyFilterControls,
  createDefaultProxyListAppliedFilters,
  syncFilterFormWithApplied,
} from '../../shared/proxy-filters';
import {filter, finalize} from 'rxjs/operators';
import {ProxyTagService} from '../../services/proxy-tag.service';
import {ProxyTagManagerComponent} from '../../shared/proxy-tag-manager/proxy-tag-manager.component';
import {WorkspaceService} from '../../services/workspace.service';

type HealthTone = 'healthy' | 'mixed' | 'unhealthy' | 'empty';
type ReputationLabel = 'good' | 'neutral' | 'poor' | 'unknown';

@Component({
  selector: 'app-scrape-source-detail',
  standalone: true,
  imports: [
    InventoryPageShellComponent,
    HlmPopoverImports,
    HlmTooltip,
    CommonModule,
    SourceScrapeStatusComponent,
    SourceFetchModeComponent,
    RouterLink,
    DatePipe,
    NgClass,
    LoadingComponent,
    ProxyFilterPanelComponent,
    ProxyTableComponent,
    ColumnPickerPanelComponent,
    ProxyTagManagerComponent,
  ],
  templateUrl: './scrape-source-detail.component.html',
  styleUrl: './scrape-source-detail.component.scss'
})
export class ScrapeSourceDetailComponent implements OnInit, OnDestroy {

  urlCopied = signal(false);
  private copyFeedbackTimeout?: ReturnType<typeof setTimeout>;

  savingFetchMode = signal(false);
  sourceId = signal<number | undefined>(undefined);
  detail = signal<ScrapeSourceDetail | null>(null);
  isLoading = signal(true);
  proxies = signal<ProxyInfo[]>([]);
  proxyPage = signal(1);
  proxyPageSize = signal(20);
  proxyTotal = signal(0);
  proxyLoading = signal(false);
  proxyHasLoaded = signal(false);
  proxySearchTerm = signal('');
  proxySortField = signal<string | null>(null);
  proxySortOrder = signal<number | null>(null);
  filterPanelOpen = signal(false);
  filterOptionsLoaded = signal(false);
  filterOptions = signal<ProxyFilterOptions>({countries: [], types: [], anonymityLevels: [], tags: []});
  countryOptions = signal<ProxyFilterOption[]>([]);
  typeOptions = signal<ProxyFilterOption[]>([]);
  anonymityOptions = signal<ProxyFilterOption[]>([]);
  appliedFilters = signal<ProxyListAppliedFilters>(createDefaultProxyListAppliedFilters());
  displayedColumns = signal<ProxyTableColumnId[]>([...DEFAULT_PROXY_TABLE_COLUMNS]);
  columnPanelOpen = signal(false);
  isSavingColumnPreferences = signal(false);
  savingTagProxyIds = signal<Record<number, boolean>>({});
  filterForm: FormGroup;
  readonly proxyStatusOptions = PROXY_STATUS_OPTIONS;
  readonly proxyReputationOptions = PROXY_REPUTATION_OPTIONS;
  readonly defaultProxyTableColumns = DEFAULT_PROXY_TABLE_COLUMNS;
  readonly proxyTableColumnDefinitions = PROXY_TABLE_COLUMN_DEFINITIONS.filter(column => column.id !== 'check_now');
  private readonly defaultFilterValues: ProxyListFilterFormValues = createDefaultProxyFilterValues();
  readonly proxySkeletonRows = Array.from({ length: 6 });

  private proxySearchDebounce?: ReturnType<typeof setTimeout>;

  private subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpService,
    private fb: FormBuilder,
    private clipboardService: ClipboardService,
    private notification: NotificationService,
    private settingsService: SettingsService,
    readonly tagService: ProxyTagService,
    readonly workspaces: WorkspaceService,
  ) {
    this.filterForm = this.fb.group({
      ...createProxyFilterControls(this.defaultFilterValues),
    });
  }

  ngOnInit(): void {
    this.tagService.load().subscribe({
      error: err => this.notification.showError(
        'Could not load proxy tags: ' + (err?.error?.error ?? err?.message ?? 'Unknown error'),
      ),
    });
    this.syncColumnsFromSettings(this.settingsService.getUserSettings());
    const settingsSub = this.settingsService.userSettings$
      .pipe(filter((settings): settings is UserSettings => !!settings))
      .subscribe(settings => this.syncColumnsFromSettings(settings));
    this.subscriptions.add(settingsSub);

    const sub = this.route.paramMap.subscribe(params => {
      const rawId = params.get('id');
      const id = rawId ? Number(rawId) : NaN;
      if (!Number.isFinite(id) || id <= 0) {
        this.notification.showError('Invalid scrape source identifier');
        this.router.navigate(['/scraper']).catch(() => {});
        return;
      }

      this.sourceId.set(id);
      this.loadScrapeSourceDetail(id);
      this.proxyPage.set(1);
      this.proxySearchTerm.set('');
      this.proxySortField.set(null);
      this.proxySortOrder.set(null);
      this.proxyHasLoaded.set(false);
      this.proxies.set([]);
      this.proxyTotal.set(0);
      this.filterPanelOpen.set(false);
      this.columnPanelOpen.set(false);
      this.loadProxyList(id);
    });

    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    clearTimeout(this.copyFeedbackTimeout);
    if (this.proxySearchDebounce) {
      clearTimeout(this.proxySearchDebounce);
      this.proxySearchDebounce = undefined;
    }
    this.subscriptions.unsubscribe();
  }

  get totalProxies(): number {
    return this.detail()?.proxy_count ?? 0;
  }

  get aliveCount(): number {
    return this.detail()?.alive_count ?? 0;
  }

  get deadCount(): number {
    return this.detail()?.dead_count ?? 0;
  }

  get unknownCount(): number {
    return this.detail()?.unknown_count ?? 0;
  }

  get healthTone(): HealthTone {
    const total = this.totalProxies;
    if (total === 0) {
      return 'empty';
    }
    const ratio = this.aliveCount / total;
    if (ratio >= 0.7) {
      return 'healthy';
    }
    if (ratio >= 0.4) {
      return 'mixed';
    }
    return 'unhealthy';
  }

  get healthLabel(): string {
    switch (this.healthTone) {
      case 'healthy':
        return 'Healthy';
      case 'mixed':
        return 'Mixed';
      case 'unhealthy':
        return 'Unhealthy';
      default:
        return 'No data';
    }
  }

  get healthPillClass(): string {
    switch (this.healthTone) {
      case 'mixed':
        return 'status-pill--mixed';
      case 'unhealthy':
        return 'status-pill--dead';
      case 'empty':
        return 'status-pill--unknown';
      default:
        return '';
    }
  }

  get healthDotClass(): Record<string, boolean> {
    return {
      alive: this.healthTone === 'healthy',
      mixed: this.healthTone === 'mixed',
      dead: this.healthTone === 'unhealthy',
      unknown: this.healthTone === 'empty',
    };
  }

  get aliveRatioDisplay(): string {
    const total = this.totalProxies;
    if (total === 0) {
      return 'No data';
    }
    const ratio = Math.round((this.aliveCount / total) * 100);
    return `${ratio}% alive`;
  }

  get averageReputationScore(): number | null {
    const value = this.detail()?.avg_reputation;
    if (value === null || value === undefined) {
      return null;
    }
    return value;
  }

  get averageReputationDisplay(): string {
    const value = this.averageReputationScore;
    if (value === null) {
      return 'N/A';
    }
    return Math.round(value).toString();
  }

  get averageReputationLabel(): ReputationLabel {
    const value = this.averageReputationScore;
    if (value === null) {
      return 'unknown';
    }
    if (value >= 75) {
      return 'good';
    }
    if (value >= 55) {
      return 'neutral';
    }
    return 'poor';
  }

  get reputationBreakdown() {
    return this.detail()?.reputation_breakdown ?? {
      good: 0,
      neutral: 0,
      poor: 0,
      unknown: 0,
    };
  }

  reputationPercent(label: ReputationLabel): number {
    const breakdown = this.reputationBreakdown;
    const total = breakdown.good + breakdown.neutral + breakdown.poor + breakdown.unknown;
    if (total === 0) {
      return 0;
    }
    return (breakdown[label] / total) * 100;
  }

  healthPercent(count: number): number {
    const total = this.totalProxies;
    if (total === 0) {
      return 0;
    }
    return (count / total) * 100;
  }

  reputationBadgeClass(label: ReputationLabel): string {
    if (label === 'good') {
      return 'reputation-badge reputation-badge--good';
    }
    if (label === 'neutral') {
      return 'reputation-badge reputation-badge--neutral';
    }
    if (label === 'poor') {
      return 'reputation-badge reputation-badge--poor';
    }
    return 'reputation-badge reputation-badge--unknown';
  }

  onProxyLazyLoad(event: TablePageEvent): void {
    const previousSortField = this.proxySortField();
    const previousSortOrder = this.proxySortOrder();
    const newPage = Math.floor((event.first ?? 0) / (event.rows ?? this.proxyPageSize())) + 1;
    const newPageSize = event.rows ?? this.proxyPageSize();
    const nextSortOrder = event.sortOrder && event.sortOrder !== 0 ? event.sortOrder : null;
    const nextSortField = nextSortOrder ? this.resolveProxySortField(event.sortField) : null;

    const sortChanged = nextSortField !== previousSortField || nextSortOrder !== previousSortOrder;
    const shouldFetch = newPage !== this.proxyPage() || newPageSize !== this.proxyPageSize();

    if (sortChanged) {
      return;
    }

    this.proxyPage.set(newPage);
    this.proxyPageSize.set(newPageSize);

    if (shouldFetch) {
      this.loadProxyList();
    }
  }

  onProxySort(event: { field: string; order: number }): void {
    const clickedSortField = this.resolveProxySortField(event.field);
    const isResetClick = clickedSortField === this.proxySortField() && this.proxySortOrder() === -1 && event.order === 1;
    const hasOrder = !isResetClick && event.order !== 0 && event.order !== undefined && event.order !== null;
    const nextSortField = hasOrder ? clickedSortField : null;
    const nextSortOrder = hasOrder ? event.order : null;

    this.proxyPage.set(1);
    this.proxySortField.set(nextSortField);
    this.proxySortOrder.set(nextSortOrder);
    this.loadProxyList();
  }

  onProxySearchTermChange(value: string): void {
    this.proxySearchTerm.set(value);
    if (this.proxySearchDebounce) {
      clearTimeout(this.proxySearchDebounce);
    }
    this.proxySearchDebounce = setTimeout(() => {
      this.proxyPage.set(1);
      this.loadProxyList();
    }, 300);
  }

  refreshProxyList(): void {
    if (this.proxySearchDebounce) {
      clearTimeout(this.proxySearchDebounce);
      this.proxySearchDebounce = undefined;
    }
    this.loadProxyList();
  }

  onFilterPopoverStateChanged(state: string): void {
    if ((state === 'open') !== this.filterPanelOpen()) {
      this.toggleFilterPanel();
    }
  }

  onColumnPopoverStateChanged(state: string): void {
    if ((state === 'open') !== this.columnPanelOpen()) {
      this.openColumnPanel();
    }
  }

  toggleFilterPanel(): void {
    const nextState = !this.filterPanelOpen();
    if (nextState) {
      this.syncFilterFormWithApplied();
      this.ensureFilterOptionsLoaded();
      this.columnPanelOpen.set(false);
    }
    this.filterPanelOpen.set(nextState);
  }

  openColumnPanel(): void {
    if (this.columnPanelOpen()) {
      this.columnPanelOpen.set(false);
      return;
    }
    this.filterPanelOpen.set(false);
    this.columnPanelOpen.set(true);
  }

  closeColumnPanel(): void {
    this.columnPanelOpen.set(false);
  }

  saveColumnPreferences(nextColumns: string[]): void {
    const previous = this.displayedColumns();
    const next = normalizeProxyTableColumns(nextColumns);

    this.displayedColumns.set(next);
    this.columnPanelOpen.set(false);
    this.isSavingColumnPreferences.set(true);

    this.settingsService.saveScrapeSourceProxyColumns(next)
      .pipe(finalize(() => this.isSavingColumnPreferences.set(false)))
      .subscribe({
        error: err => {
          this.displayedColumns.set(previous);
          const message = err?.error?.message ?? err?.message ?? 'Unknown error';
          this.notification.showError('Could not save column settings: ' + message);
        }
      });
  }

  applyFilters(): void {
    const nextFilters = this.buildFiltersFromForm();
    this.appliedFilters.set(nextFilters);
    this.proxyPage.set(1);
    this.loadProxyList();
    this.filterPanelOpen.set(false);
  }

  clearFilters(): void {
    this.filterForm.reset(this.defaultFilterValues);
    this.appliedFilters.set(createDefaultProxyListAppliedFilters());
    this.proxyPage.set(1);
    this.loadProxyList();
  }

  filterButtonLabel(): string {
    const count = this.activeFilterCount();
    if (count === 0) {
      return 'Filters';
    }
    return `Filters (${count})`;
  }

  hasActiveFilters(): boolean {
    return this.activeFilterCount() > 0;
  }

  onViewProxy(proxy: ProxyInfo): void {
    const sourceId = this.sourceId();
    const queryParams = sourceId ? { sourceId } : undefined;
    this.router.navigate(['/proxies', proxy.id], { queryParams }).catch(() => {});
  }

  onTagSelectionChange(event: {proxy: ProxyInfo; tagIds: number[]}): void {
    const proxy = event.proxy;
    if (!proxy?.id || !this.workspaces.canOperate() || this.savingTagProxyIds()[proxy.id]) {
      return;
    }

    this.savingTagProxyIds.update(current => ({...current, [proxy.id]: true}));
    this.tagService.replaceProxyTags(proxy.id, event.tagIds).subscribe({
      next: tags => {
        proxy.tags = tags;
        this.proxies.set([...this.proxies()]);
      },
      error: err => this.notification.showError(
        'Could not update proxy tags: ' + (err?.error?.error ?? err?.message ?? 'Unknown error'),
      ),
    }).add(() => {
      this.savingTagProxyIds.update(current => {
        const next = {...current};
        delete next[proxy.id];
        return next;
      });
    });
  }

  onTagCatalogChanged(): void {
    const valid = new Set(this.tagService.tags().map(tag => tag.id));
    const current = this.appliedFilters();
    const tagIds = current.tagIds.filter(id => valid.has(id));
    if (tagIds.length === current.tagIds.length) {
      return;
    }
    this.appliedFilters.set({...current, tagIds});
    this.proxyPage.set(1);
    this.loadProxyList();
  }

  prepareUrlScroll(link: HTMLElement): void {
    const text = link.querySelector<HTMLElement>('.source-title__text');
    const overflow = Math.max(0, (text?.scrollWidth ?? 0) - link.clientWidth);
    link.style.setProperty('--url-scroll-distance', `${-overflow}px`);
    link.style.setProperty('--url-scroll-duration', `${overflow / 40 + 2}s`);
    link.classList.toggle('source-title--overflowing', overflow > 0);
  }

  async copyUrl(): Promise<void> {
    const value = this.detail()?.url?.trim();
    if (!value) {
      return;
    }
    this.urlCopied.set(true);
    clearTimeout(this.copyFeedbackTimeout);
    this.copyFeedbackTimeout = setTimeout(() => this.urlCopied.set(false), 1400);
    const copied = await this.clipboardService.copyText(value);
    if (!copied) {
      clearTimeout(this.copyFeedbackTimeout);
      this.urlCopied.set(false);
      this.notification.showError('Failed to access clipboard');
    }
  }

  setRequiresJavaScript(enabled: boolean): void {
    const sourceId = this.sourceId();
    if (!sourceId || this.savingFetchMode() || !this.workspaces.canOperate()) return;
    this.savingFetchMode.set(true);
    this.subscriptions.add(this.http.updateScrapeSourceSettings(sourceId, enabled ? 'browser' : 'http').subscribe({
      next: () => { this.savingFetchMode.set(false); this.loadScrapeSourceDetail(sourceId); },
      error: err => {
        this.savingFetchMode.set(false);
        this.notification.showError('Could not save source settings: ' + (err?.error?.error ?? err?.message ?? 'Unknown error'));
      }
    }));
  }

  private loadScrapeSourceDetail(id: number): void {
    this.isLoading.set(true);
    const sub = this.http.getScrapeSourceDetail(id).subscribe({
      next: detail => {
        this.detail.set(detail ?? null);
        this.isLoading.set(false);
      },
      error: err => {
        this.notification.showError('Could not load scrape source detail: ' + (err?.error?.error ?? err?.message ?? 'Unknown error'));
        this.isLoading.set(false);
        this.router.navigate(['/scraper']).catch(() => {});
      }
    });

    this.subscriptions.add(sub);
  }

  private loadProxyList(id?: number): void {
    const sourceId = id ?? this.sourceId();
    if (!sourceId) {
      return;
    }

    this.proxyLoading.set(true);
    const sub = this.http.getScrapeSourceProxyPage(sourceId, {
      page: this.proxyPage(),
      rows: this.proxyPageSize(),
      search: this.proxySearchTerm(),
      filters: this.buildFilterPayload(this.appliedFilters()),
      includeHealth: this.columnsNeedHealth(this.displayedColumns()),
      includeReputation: this.displayedColumns().includes('reputation'),
      sortField: this.proxySortField(),
      sortOrder: this.proxySortOrder(),
    }).subscribe({
      next: res => {
        this.proxies.set(res?.proxies ?? []);
        this.proxyTotal.set(res?.total ?? 0);
        this.proxyLoading.set(false);
        this.proxyHasLoaded.set(true);
      },
      error: err => {
        this.notification.showError('Could not load scrape source proxies: ' + (err?.error?.error ?? err?.message ?? 'Unknown error'));
        this.proxyLoading.set(false);
        this.proxyHasLoaded.set(true);
      }
    });

    this.subscriptions.add(sub);
  }

  private activeFilterCount(): number {
    return activeProxyFilterCount(this.appliedFilters());
  }

  private ensureFilterOptionsLoaded(): void {
    if (this.filterOptionsLoaded()) {
      return;
    }
    loadProxyFilterOptions(this.http, this.notification).subscribe(options => {
      this.filterOptions.set(options.filters);
      this.countryOptions.set(options.countries);
      this.typeOptions.set(options.types);
      this.anonymityOptions.set(options.anonymityLevels);
      this.filterOptionsLoaded.set(true);
    });
  }

  private syncFilterFormWithApplied(): void {
    syncFilterFormWithApplied(this.filterForm, this.appliedFilters());
  }

  private buildFiltersFromForm(): ProxyListAppliedFilters {
    const formValue = this.filterForm.getRawValue() as ProxyListFilterFormValues;
    return buildFiltersFromFormValue(formValue);
  }

  private buildFilterPayload(filters: ProxyListAppliedFilters): ProxyListFilters | undefined {
    return buildProxyListFilterPayload(filters);
  }

  private columnsNeedHealth(columns: readonly ProxyTableColumnId[]): boolean {
    return columns.some(column =>
      column === 'health_overall' ||
      column === 'health_http' ||
      column === 'health_https' ||
      column === 'health_socks4' ||
      column === 'health_socks5'
    );
  }

  private resolveProxySortField(sortField: TablePageEvent['sortField']): string | null {
    if (!sortField) {
      return this.proxySortField() ?? null;
    }

    return Array.isArray(sortField) ? sortField[0] : sortField;
  }

  private syncColumnsFromSettings(settings: UserSettings | undefined): void {
    const normalized = normalizeProxyTableColumns(settings?.scrape_source_proxy_columns ?? DEFAULT_PROXY_TABLE_COLUMNS);
    this.displayedColumns.set(normalized.filter(column => column !== 'check_now'));
  }

}
