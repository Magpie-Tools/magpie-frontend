import {
  Component, ElementRef, Injector, OnDestroy, afterNextRender, computed, effect, inject, input, output, signal, untracked,
} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {HlmPopoverImports} from '@spartan-ng/helm/popover';
import {Subscription} from 'rxjs';
import {HttpService} from '../../../services/http.service';
import {ProxyStatistic, ProxyStatisticSort, ProxyStatisticsPage, ProxyStatisticsQuery} from '../../../models/ProxyStatistic';
import {PaginationComponent, TablePageEvent} from '../../../shared/ui/pagination.component';
import {PageScrollTarget, readPageSize, scrollTableToPageTarget, writePageSize} from '../../../shared/table-pagination';

type Status = 'all' | 'alive' | 'dead';
type Settings = '' | 'current' | 'previous';
type SortState = {field: ProxyStatisticSort; order: 'asc' | 'desc'};
/** The last completed response: rows, zero matches for the filters, no checks at all, or a failed request. */
type Outcome = 'rows' | 'empty' | 'none' | 'error';
/** What started a request; focus and scrolling after the response depend on it. */
type Origin = 'initial' | 'filter' | 'sort' | 'pager' | 'retry';

interface Column {
  id: string;
  label: string;
  cell: string;
  sort?: ProxyStatisticSort;
  /** First click direction; Checked at and Anonymity start descending. */
  firstOrder?: 'asc' | 'desc';
  numeric?: boolean;
}

interface Completion {
  page?: ProxyStatisticsPage;
  outcome: Outcome;
  summary: string;
  origin: Origin;
  defaultQuery: boolean;
}

const DEFAULT_SORT: SortState = {field: 'checked', order: 'desc'};
const PAGE_SIZE_KEY = 'magpie.proxyCheckHistory.pageSize';
const PAGE_SCROLL_KEY = 'magpie.proxyCheckHistory.pageScrollTarget';
const PAGE_SIZES = [20, 50, 100];
const DEFAULT_PERIOD = 0;

/**
 * The proxy detail page's check history: status, protocol, judge, settings and
 * period filters, six sortable columns with the proxy list's cycle, and the
 * shared pagination. Below 61rem rows become cards; on phones the dropdowns move
 * into a Filters sheet.
 */
@Component({
  selector: 'app-proxy-check-history',
  standalone: true,
  imports: [HlmPopoverImports, NgTemplateOutlet, PaginationComponent],
  templateUrl: './proxy-check-history.component.html',
  styleUrl: './proxy-check-history.component.scss',
})
export class ProxyCheckHistoryComponent implements OnDestroy {
  readonly proxyId = input.required<number>();
  /** Opens the judge response for a check. */
  readonly openResponse = output<ProxyStatistic>();
  /** The unfiltered, newest-first first page, for the page's latest-check fallback. */
  readonly firstPage = output<ProxyStatistic[]>();

  private readonly http = inject(HttpService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly pageSizeOptions = PAGE_SIZES;
  readonly pageScrollKey = PAGE_SCROLL_KEY;
  readonly skeletonRows = Array.from({length: 8}, (_, i) => i);
  readonly periodOptions = [
    {value: 0, label: 'Any time'},
    {value: 1, label: 'Last hour'},
    {value: 24, label: 'Last 24 hours'},
    {value: 168, label: 'Last 7 days'},
    {value: 720, label: 'Last 30 days'},
  ];
  readonly settingsOptions: {value: Settings; label: string}[] = [
    {value: '', label: 'Any settings'},
    {value: 'current', label: 'Current settings'},
    {value: 'previous', label: 'Previous or legacy settings'},
  ];
  readonly columns: Column[] = [
    {id: 'status', label: 'Status', cell: 'status-cell'},
    {id: 'response', label: 'Response', cell: 'resp', sort: 'response', numeric: true},
    {id: 'attempt', label: 'Attempt', cell: 'att', sort: 'attempt', numeric: true},
    {id: 'protocol', label: 'Protocol', cell: 'proto', sort: 'protocol'},
    {id: 'anonymity', label: 'Anonymity', cell: 'anon', sort: 'anonymity', firstOrder: 'desc'},
    {id: 'judge', label: 'Judge', cell: 'judge', sort: 'judge'},
    {id: 'checked', label: 'Checked at', cell: 'at-col', sort: 'checked', firstOrder: 'desc'},
  ];

  // Filters, sort and paging: the user's state, independent of responses.
  readonly status = signal<Status>('all');
  readonly protocol = signal('');
  readonly judgeId = signal(0);
  readonly settings = signal<Settings>('');
  readonly hours = signal(DEFAULT_PERIOD);
  readonly sort = signal<SortState>(DEFAULT_SORT);
  readonly page = signal(1);
  readonly pageSize = signal(readPageSize(PAGE_SIZE_KEY, PAGE_SIZES) ?? PAGE_SIZES[0]);

  // Results.
  /** The last response with rows (kept on screen, dimmed, while the next one loads). */
  readonly result = signal<ProxyStatisticsPage | null>(null);
  readonly outcome = signal<Outcome | null>(null);
  readonly loading = signal(false);
  readonly origin = signal<Origin>('initial');
  /** Summary of the filters submitted with the last zero-result request. */
  readonly emptySummary = signal('');
  readonly options = signal<ProxyStatisticsPage['options']>({protocols: [], judges: []});
  readonly liveMessage = signal('');

  // Phone filter sheet. The card behind it is frozen; only the sheet's status speaks.
  readonly sheetOpen = signal(false);
  readonly sheetStatus = signal('');
  private deferred: Completion | null = null;

  private pageScrollTarget: PageScrollTarget = 'top';
  private request?: Subscription;
  private loadedFor?: number;

  readonly hasFilters = computed(() =>
    this.status() !== 'all' || !!this.protocol() || !!this.judgeId() || !!this.settings() || this.hours() !== DEFAULT_PERIOD);
  /** The phone button counts only the fields inside the sheet; status stays inline. */
  readonly sheetFilterCount = computed(() =>
    [!!this.protocol(), !!this.judgeId(), !!this.settings(), this.hours() !== DEFAULT_PERIOD].filter(Boolean).length);
  readonly firstLoad = computed(() => this.outcome() === null);
  /** Try again on the same query keeps the error on screen with the progress bar. */
  readonly retrying = computed(() => this.loading() && this.outcome() === 'error' && this.origin() === 'retry');
  /** Any other request after a response without rows shows "Loading checks…" instead of old rows. */
  readonly withheld = computed(() => this.loading() && (this.outcome() === 'error' || this.outcome() === 'none') && !this.retrying());
  readonly noChecks = computed(() => this.outcome() === 'none' && !this.loading());
  readonly rows = computed(() =>
    this.outcome() === 'rows' && !this.withheld() ? this.result()?.statistics ?? [] : []);
  /** Per-status counts appear only for a completed query; a filter change hides them until it returns. */
  readonly counts = computed(() => {
    const outcome = this.outcome();
    if (outcome === null || outcome === 'error' || outcome === 'none' || this.withheld()) return null;
    if (this.loading() && (this.origin() === 'filter')) return null;
    return outcome === 'empty' ? {alive: 0, dead: 0} : this.result()?.counts ?? null;
  });
  readonly total = computed(() => this.outcome() === 'rows' ? this.result()?.total ?? 0 : 0);
  readonly showFooter = computed(() => this.outcome() === 'rows' && this.total() > 0 && !this.withheld());
  readonly showEmpty = computed(() => this.outcome() === 'empty' && !this.withheld() && !this.retrying());
  readonly showError = computed(() => this.outcome() === 'error' && (this.retrying() || !this.loading()));
  readonly protocolOptions = computed(() => this.options().protocols.map(option => ({
    value: `${option.protocol}/${option.transport}`,
    label: `${option.protocol.toUpperCase()} / ${(option.transport || 'tcp').toUpperCase()}`,
  })));
  readonly judgeOptions = computed(() => {
    const judges = this.options().judges;
    return judges.map(judge => ({value: judge.id, label: this.judgeLabel(judge.url, judges.map(j => j.url))}));
  });

  constructor() {
    effect(() => {
      const id = this.proxyId();
      if (id && id !== this.loadedFor) {
        this.loadedFor = id;
        untracked(() => this.resetAndLoad());
      }
    });
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
  }

  // --- Filters -------------------------------------------------------------

  setStatus(status: Status): void {
    if (this.status() === status) return;
    this.status.set(status);
    this.startQuery('filter');
  }

  setProtocol(value: string): void {
    this.protocol.set(value);
    this.startQuery('filter');
  }

  setJudge(value: string): void {
    this.judgeId.set(Number(value) || 0);
    this.startQuery('filter');
  }

  setSettings(value: string): void {
    this.settings.set(value === 'current' || value === 'previous' ? value : '');
    this.startQuery('filter');
  }

  setHours(value: string): void {
    const hours = Number(value);
    this.hours.set(this.periodOptions.some(option => option.value === hours) ? hours : DEFAULT_PERIOD);
    this.startQuery('filter');
  }

  /** Resets every filter including status; focus moves to All because the button goes away. */
  clearFilters(): void {
    this.status.set('all');
    this.clearSheetFilters(false);
    this.startQuery('filter');
    this.afterRender(() => this.host.nativeElement.querySelector<HTMLElement>('[data-status="all"]')?.focus());
  }

  /** The sheet's reset: only its dropdowns; status stays as set. */
  clearSheetFilters(reload = true): void {
    this.protocol.set('');
    this.judgeId.set(0);
    this.settings.set('');
    this.hours.set(DEFAULT_PERIOD);
    if (reload) this.startQuery('filter');
  }

  onSheetState(state: string): void {
    const open = state === 'open';
    if (open === this.sheetOpen()) return;
    this.sheetOpen.set(open);
    if (open) {
      this.liveMessage.set('');
      this.sheetStatus.set(this.statusText());
      return;
    }
    // The card catches up with whatever arrived while the sheet was open, without replaying it.
    const deferred = this.deferred;
    this.deferred = null;
    if (deferred) this.commit(deferred, false);
    // The card was inert while the sheet was open, so return focus once it is interactive again: to the
    // Filters button, or the heading when the button is gone; on screen either way.
    this.afterRender(() => {
      const active = document.activeElement;
      if (active && active !== document.body && !active.closest('.history-sheet')) return;
      const root = this.host.nativeElement;
      this.focus(root.querySelector<HTMLElement>('.tool-button') ?? root.querySelector<HTMLElement>('.history-title'));
    });
  }

  closeSheet(): void {
    this.onSheetState('closed');
  }

  // --- Sorting and paging --------------------------------------------------

  sortBy(column: Column): void {
    if (!column.sort || this.loading()) return; // aria-disabled while a request runs
    const first = column.firstOrder ?? 'asc';
    const current = this.sort();
    let next: SortState;
    if (current.field !== column.sort) next = {field: column.sort, order: first};
    else if (current.order === first) next = {field: column.sort, order: first === 'asc' ? 'desc' : 'asc'};
    else next = DEFAULT_SORT; // third click resets, as in the proxy list
    this.sort.set(next);
    this.startQuery('sort');
  }

  ariaSort(column: Column): 'ascending' | 'descending' | 'none' {
    const sort = this.sort();
    return sort.field === column.sort ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none';
  }

  onPageChange(event: TablePageEvent): void {
    const rows = event.rows && PAGE_SIZES.includes(event.rows) ? event.rows : this.pageSize();
    if (rows !== this.pageSize()) {
      this.pageSize.set(rows);
      writePageSize(PAGE_SIZE_KEY, rows);
    }
    this.page.set(Math.floor((event.first ?? 0) / rows) + 1);
    this.load('pager');
  }

  onPageScrollTargetChange(target: PageScrollTarget): void {
    this.pageScrollTarget = target;
  }

  retry(): void {
    if (this.retrying()) return;
    this.load('retry');
  }

  // --- Requests ------------------------------------------------------------

  private resetAndLoad(): void {
    this.result.set(null);
    this.outcome.set(null);
    this.page.set(1);
    this.load('initial');
  }

  /** A filter or sort change starts a new query on page 1 and supersedes any pending request. */
  private startQuery(origin: Origin): void {
    this.page.set(1);
    this.load(origin);
  }

  private load(origin: Origin): void {
    const id = this.proxyId();
    if (!id) return;
    this.request?.unsubscribe(); // the superseded response is ignored
    const query = this.buildQuery();
    const summary = this.filterSummary();
    const filtered = this.hasFilters();
    const defaultQuery = !filtered && query.page === 1 && query.sort === DEFAULT_SORT.field && query.order === DEFAULT_SORT.order;
    this.origin.set(origin);
    this.loading.set(true);
    this.announce('Loading checks…');
    this.request = this.http.getProxyStatisticsPage(id, query).subscribe({
      next: page => this.complete({
        page, summary, origin, defaultQuery,
        outcome: page.total > 0 ? 'rows' : filtered ? 'empty' : 'none',
      }),
      error: () => this.complete({outcome: 'error', summary, origin, defaultQuery}),
    });
  }

  private buildQuery(): ProxyStatisticsQuery {
    const [protocol, transport] = this.protocol().split('/');
    const status = this.status();
    const settings = this.settings();
    return {
      page: this.page(),
      pageSize: this.pageSize(),
      sort: this.sort().field,
      order: this.sort().order,
      status: status === 'all' ? undefined : status,
      protocol: protocol || undefined,
      transport: transport || undefined,
      judgeId: this.judgeId() || undefined,
      settings: settings || undefined,
      hours: this.hours() || undefined,
    };
  }

  private complete(completion: Completion): void {
    if (completion.page) this.options.set(completion.page.options);
    if (completion.outcome === 'rows' && completion.defaultQuery) this.firstPage.emit(completion.page!.statistics);
    if (this.sheetOpen()) {
      // Frozen behind the sheet: record it, let the sheet speak, apply on close.
      this.deferred = completion;
      this.loading.set(false);
      this.sheetStatus.set(this.statusText(completion));
      return;
    }
    this.commit(completion, true);
  }

  private commit(completion: Completion, announce: boolean): void {
    const activeBefore = document.activeElement as HTMLElement | null;
    const focusInPager = !!activeBefore?.closest('app-pagination');
    const focusIdle = !activeBefore || activeBefore === document.body;
    const focusOnRetry = !!activeBefore?.matches('[data-action="retry"]');
    const focusInCard = !!activeBefore && this.host.nativeElement.contains(activeBefore);
    if (completion.page && completion.outcome === 'rows') this.result.set(completion.page);
    if (completion.outcome === 'empty') this.emptySummary.set(completion.summary);
    this.outcome.set(completion.outcome);
    this.loading.set(false);
    if (announce) this.announce(this.statusText(completion));
    this.afterRender(() => this.restoreFocus(completion, {focusInPager, focusIdle, focusOnRetry, focusInCard}));
  }

  private restoreFocus(completion: Completion, focus: {focusInPager: boolean; focusIdle: boolean; focusOnRetry: boolean; focusInCard: boolean}): void {
    const root = this.host.nativeElement;
    const results = root.querySelector<HTMLElement>('.table-scroll');
    const heading = root.querySelector<HTMLElement>('.history-title');
    if (completion.origin === 'pager') {
      if (completion.outcome === 'rows') {
        scrollTableToPageTarget(root.querySelector<HTMLElement>('.history-table') ?? undefined, this.pageScrollTarget);
        if (focus.focusInPager || focus.focusIdle) {
          if (this.pageScrollTarget === 'top') this.focus(results);
          else this.focusPagerFallback();
        }
      } else if (focus.focusInPager || focus.focusIdle) {
        // The pager is gone: focus the message panel's action, else the panel.
        this.focus(root.querySelector<HTMLElement>('.history-message button:not([disabled])') ?? root.querySelector<HTMLElement>('.history-message'));
      }
      return;
    }
    if (completion.origin === 'retry' && (focus.focusOnRetry || focus.focusIdle)) {
      if (completion.outcome === 'rows') this.focus(results, true);
      else if (completion.outcome === 'error') this.focus(root.querySelector<HTMLElement>('[data-action="retry"]'));
      else this.focus(heading);
      return;
    }
    // A control that disappeared with the response hands focus to the heading.
    if (focus.focusInCard && (!document.activeElement || document.activeElement === document.body)) this.focus(heading);
  }

  /** A pager control disabled after the load (first/last page, one page) hands focus down this chain. */
  private focusPagerFallback(): void {
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && !(active as HTMLButtonElement).disabled) return;
    const pager = this.host.nativeElement.querySelector('app-pagination');
    const chain = ['[aria-label="Previous page"]', '[aria-label="Next page"]', '.page-jump__input', '.page-jump__submit', '.pagination-size select'];
    for (const selector of chain) {
      const el = pager?.querySelector<HTMLElement>(selector);
      if (el && !(el as HTMLButtonElement).disabled && el.getClientRects().length) {
        this.focus(el);
        return;
      }
    }
  }

  private focus(el: HTMLElement | null | undefined, scrollIfOffscreen = false): void {
    if (!el) return;
    el.focus({preventScroll: true});
    const rect = el.getBoundingClientRect();
    if (scrollIfOffscreen ? rect.top < 80 || rect.top > window.innerHeight - 40 : rect.bottom < 80 || rect.top > window.innerHeight) {
      el.scrollIntoView({block: scrollIfOffscreen ? 'start' : 'nearest'});
    }
  }

  private announce(message: string): void {
    if (this.sheetOpen()) {
      this.sheetStatus.set(message);
      return; // only one region speaks while the sheet is open
    }
    // Re-announce an unchanged message (e.g. the same range after a request).
    if (this.liveMessage() === message) this.liveMessage.set('');
    this.afterRender(() => this.liveMessage.set(message));
  }

  private statusText(completion?: Completion): string {
    if (!completion) {
      if (this.loading()) return 'Loading checks…';
      const outcome = this.outcome();
      if (outcome === 'error') return "Couldn't load checks";
      if (outcome === 'none') return 'No checks yet';
      const total = this.total();
      return `${total.toLocaleString()} ${total === 1 ? 'check matches' : 'checks match'}`;
    }
    switch (completion.outcome) {
      case 'error': return this.sheetOpen() ? "Couldn't load checks" : "Couldn't load check history";
      case 'none': return 'No checks yet';
      case 'empty': return this.sheetOpen() ? '0 checks match' : 'No checks match these filters';
      default: {
        const page = completion.page!;
        if (this.sheetOpen()) return `${page.total.toLocaleString()} ${page.total === 1 ? 'check matches' : 'checks match'}`;
        const from = (page.page - 1) * page.page_size + 1;
        const to = Math.min(page.page * page.page_size, page.total);
        return `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${page.total.toLocaleString()} checks`;
      }
    }
  }

  private afterRender(fn: () => void): void {
    afterNextRender(fn, {injector: this.injector});
  }

  // --- Display helpers -----------------------------------------------------

  /** The submitted filters, listed in the No matches panel. */
  private filterSummary(): string {
    const parts: string[] = [];
    if (this.status() !== 'all') parts.push(this.status() === 'dead' ? 'Dead' : 'Alive');
    const protocol = this.protocolOptions().find(option => option.value === this.protocol());
    if (this.protocol()) parts.push(protocol?.label ?? this.protocol().toUpperCase());
    const judge = this.judgeOptions().find(option => option.value === this.judgeId());
    if (this.judgeId()) parts.push(judge?.label ?? 'Judge');
    const settings = this.settingsOptions.find(option => option.value === this.settings());
    if (this.settings() && settings) parts.push(settings.label);
    const period = this.periodOptions.find(option => option.value === this.hours());
    if (this.hours() !== DEFAULT_PERIOD && period) parts.push(period.label);
    return parts.join(' · ');
  }

  selectedLabel(options: {value: string | number; label: string}[], value: string | number, fallback: string): string {
    return options.find(option => option.value === value)?.label ?? fallback;
  }

  /** Scheme dropped unless it tells two judges apart; the trailing slash is kept. */
  judgeLabel(url: string, all: string[] = this.options().judges.map(judge => judge.url)): string {
    const strip = (value: string) => value.replace(/^https?:\/\//, '');
    return all.filter(other => strip(other) === strip(url)).length > 1 ? url : strip(url);
  }

  /** Break opportunities after . / - ? = so long judge URLs wrap instead of being cut. */
  breakParts(text: string): string[] {
    return text.split(/(?<=[./\-?=])/);
  }

  anonymity(row: ProxyStatistic): string {
    const level = (row.anonymity_level || '').toLowerCase();
    return level && level !== 'unknown' && level !== 'n/a' ? row.anonymity_level : 'Unknown';
  }

  protocolLabel(row: ProxyStatistic): string {
    const protocol = row.protocol ? row.protocol.toUpperCase() : 'Unknown';
    return row.transport ? `${protocol} / ${row.transport.toUpperCase()}` : protocol;
  }

  settingsNote(row: ProxyStatistic): string | null {
    if (row.current !== false) return null;
    return row.config_key ? 'Previous settings' : 'Legacy settings';
  }

  attemptLabel(row: ProxyStatistic): string {
    const attempt = row.attempt + 1;
    return row.retries != null ? `${attempt} of ${row.retries + 1}` : `${attempt}`;
  }

  checkedDate(row: ProxyStatistic): string {
    const date = new Date(row.created_at);
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString('en-US', sameYear ? {month: 'short', day: 'numeric'} : {month: 'short', day: 'numeric', year: 'numeric'});
  }

  checkedTime(row: ProxyStatistic): string {
    return new Date(row.created_at).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
  }

  hasYear(row: ProxyStatistic): boolean {
    return new Date(row.created_at).getFullYear() !== new Date().getFullYear();
  }

  open(row: ProxyStatistic): void {
    this.openResponse.emit(row);
  }

  get first(): number {
    return (this.page() - 1) * this.pageSize();
  }
}
