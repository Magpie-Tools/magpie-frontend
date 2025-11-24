import {AfterViewInit, Component, EventEmitter, OnDestroy, OnInit, Output, signal} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpService} from '../../services/http.service';
import {ProxyInfo} from '../../models/ProxyInfo';
import {DatePipe, NgClass} from '@angular/common';
import {LoadingComponent} from '../../ui-elements/loading/loading.component';
import {SelectionModel} from '@angular/cdk/collections';
import {TableLazyLoadEvent} from 'primeng/table'; // Keep this for onLazyLoad
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {CheckboxModule} from 'primeng/checkbox';
import {NotificationService} from '../../services/notification-service.service';
import {Subscription} from 'rxjs';
import {ExportProxiesComponent} from './export-proxies/export-proxies.component';
import {AddProxiesComponent} from './add-proxies/add-proxies.component';
import {Router} from '@angular/router';
import {DeleteProxiesComponent} from './delete-proxies/delete-proxies.component';
import {ProxyReputation} from '../../models/ProxyReputation';
import {Tooltip} from 'primeng/tooltip';

@Component({
  selector: 'app-proxy-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    LoadingComponent,
    ButtonModule,
    TableModule,
    CheckboxModule,
    AddProxiesComponent,
    ExportProxiesComponent,
    DeleteProxiesComponent,
    NgClass,
    Tooltip,
  ],
  templateUrl: './proxy-list.component.html',
  styleUrls: ['./proxy-list.component.scss']
})
export class ProxyListComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() showAddProxiesMessage = new EventEmitter<boolean>();

  dataSource = signal<ProxyInfo[]>([]);
  selection = new SelectionModel<ProxyInfo>(true, []);
  selectedProxies = signal<ProxyInfo[]>([]);
  page = signal(1);
  pageSize = signal(40);
  displayedColumns: string[] = ['select', 'alive', 'ip', 'port', 'response_time', 'estimated_type', 'country', 'reputation', 'latest_check', 'actions'];
  totalItems = signal(0);
  hasLoaded = signal(false);
  isLoading = signal(false);
  searchTerm = signal('');
  private searchDebounceHandle?: ReturnType<typeof setTimeout>;

  sortField = signal<string | null>(null);
  sortOrder = signal<number | null>(null); // 1 for ascending, -1 for descending

  private proxyListSubscription?: Subscription;

  constructor(private http: HttpService, private router: Router) { }

  ngAfterViewInit() {
    // PrimeNG table handles sorting internally with pSortableColumn and (onSort)
  }

  ngOnInit(): void {
    this.getAndSetProxyList();
  }

  getAndSetProxyList(event?: TableLazyLoadEvent) {
    this.proxyListSubscription?.unsubscribe();
    this.isLoading.set(true);
    const page = event ? Math.floor((event.first ?? 0) / (event.rows ?? this.pageSize())) + 1 : this.page();
    const rows = event?.rows ?? this.pageSize();
    const requestedSortField = this.resolveSortField(event?.sortField);
    const requestedSortOrder = event?.sortOrder ?? this.sortOrder() ?? null;
    const normalizedSortOrder = requestedSortOrder && requestedSortOrder !== 0 ? requestedSortOrder : null;
    const normalizedSortField = normalizedSortOrder ? requestedSortField : null;

    this.sortField.set(normalizedSortField);
    this.sortOrder.set(normalizedSortOrder);

    const trimmedSearch = this.searchTerm().trim();

    this.proxyListSubscription = this.http.getProxyPage(page, {
      rows,
      search: trimmedSearch.length > 0 ? trimmedSearch : undefined,
    }).subscribe({
      next: res => {
        const data = [...res.proxies];
        this.page.set(page);
        this.pageSize.set(rows);
        const sorted = this.applySort(data, normalizedSortField, normalizedSortOrder);
        this.dataSource.set(sorted);
        this.totalItems.set(res.total ?? sorted.length);
        this.pruneSelection();
        this.isLoading.set(false);
        this.hasLoaded.set(true);
        this.showAddProxiesMessage.emit(this.totalItems() === 0 && this.hasLoaded());
      },
      error: err => {
        NotificationService.showError('Could not get proxy page: ' + err.error.message);
        this.isLoading.set(false);
        this.hasLoaded.set(true);
      }
    });
  }

  ngOnDestroy(): void {
    this.proxyListSubscription?.unsubscribe();
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
    }
  }

  onLazyLoad(event: TableLazyLoadEvent) {
    const previousSortField = this.sortField();
    const previousSortOrder = this.sortOrder();

    const newPage = Math.floor(event.first! / event.rows!) + 1;
    const newPageSize = event.rows ?? this.pageSize();

    const normalizedSortOrder = event.sortOrder && event.sortOrder !== 0 ? event.sortOrder : null;
    const normalizedSortField = normalizedSortOrder ? this.resolveSortField(event.sortField) : null;

    const sortChanged = normalizedSortField !== previousSortField || normalizedSortOrder !== previousSortOrder;
    const pageChanged = newPage !== this.page();
    const pageSizeChanged = newPageSize !== this.pageSize();

    this.page.set(newPage);
    this.pageSize.set(newPageSize);
    this.sortField.set(normalizedSortField);
    this.sortOrder.set(normalizedSortOrder);

    if (!sortChanged && (pageChanged || pageSizeChanged)) {
      this.getAndSetProxyList(event);
    }
  }

  onSort(event: { field: string; order: number }) {
    const hasOrder = event.order !== 0 && event.order !== undefined && event.order !== null;
    this.sortField.set(hasOrder ? this.resolveSortField(event.field) : null);
    this.sortOrder.set(hasOrder ? event.order : null);
    const sorted = this.applySort([...this.dataSource()], this.sortField(), this.sortOrder());
    this.dataSource.set(sorted);
  }

  toggleSelection(proxy: ProxyInfo): void {
    this.selection.toggle(proxy);
    this.selectedProxies.set([...this.selection.selected]);
  }

  isAllSelected(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource().length;
    return numSelected === numRows && numRows > 0; // Added numRows > 0 to handle empty table case
  }

  masterToggle(): void {
    this.isAllSelected() ?
      this.selection.clear() :
      this.dataSource().forEach(row => this.selection.select(row));
    this.selectedProxies.set([...this.selection.selected]);
  }

  onProxiesDeleted(): void {
    this.selection.clear();
    this.selectedProxies.set([]);
    this.getAndSetProxyList();
  }

  onSearchTermChange(value: string): void {
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
    }

    this.searchTerm.set(value);
    this.searchDebounceHandle = setTimeout(() => {
      this.page.set(1);
      this.getAndSetProxyList();
    }, 300);
  }

  private resolveSortField(sortField: TableLazyLoadEvent['sortField']): string | null {
    if (!sortField) {
      return this.sortField() ?? null;
    }

    return Array.isArray(sortField) ? sortField[0] : sortField;
  }

  private applySort(data: ProxyInfo[], sortField: string | null | undefined, sortOrder: number | null | undefined): ProxyInfo[] {
    if (!sortField || !sortOrder || sortOrder === 0) {
      return data;
    }

    const direction = sortOrder === 1 ? 1 : -1;

    return data.sort((a, b) => {
      const valueA = this.normalizeSortableValue(this.getSortableValue(a, sortField));
      const valueB = this.normalizeSortableValue(this.getSortableValue(b, sortField));

      if (valueA === valueB) {
        return 0;
      }

      if (valueA === undefined || valueA === null) {
        return 1 * direction;
      }

      if (valueB === undefined || valueB === null) {
        return -1 * direction;
      }

      if (valueA < valueB) {
        return -1 * direction;
      }

      if (valueA > valueB) {
        return 1 * direction;
      }

      return 0;
    });
  }

  private normalizeSortableValue(value: unknown): string | number | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    if (typeof value === 'string') {
      const timestamp = Date.parse(value);
      return Number.isNaN(timestamp) ? value.toLowerCase() : timestamp;
    }

    return null;
  }

  private getSortableValue(proxy: ProxyInfo, field: string | null | undefined): unknown {
    if (!field) {
      return null;
    }

    if (field === 'reputation') {
      return this.getPrimaryReputation(proxy)?.score ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(proxy, field)) {
      return proxy[field as keyof ProxyInfo];
    }

    return null;
  }

  onProxiesAdded(): void {
    this.selection.clear();
    this.selectedProxies.set([]);
    this.page.set(1);
    this.getAndSetProxyList();
  }

  refreshList(): void {
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
      this.searchDebounceHandle = undefined;
    }

    this.getAndSetProxyList();
  }

  private pruneSelection(): void {
    if (this.selection.isEmpty()) {
      this.selectedProxies.set([]);
      return;
    }

    const ids = new Set(this.dataSource().map(proxy => proxy.id));
    const retained = this.selection.selected.filter(proxy => ids.has(proxy.id));

    this.selection.clear();
    retained.forEach(proxy => this.selection.select(proxy));
    this.selectedProxies.set([...retained]);
  }

  onViewProxy(event: Event | { originalEvent?: Event }, proxy: ProxyInfo): void {
    if ((event as { originalEvent?: Event }).originalEvent) {
      (event as { originalEvent?: Event }).originalEvent?.stopPropagation?.();
    } else {
      (event as Event)?.stopPropagation?.();
    }
    this.router.navigate(['/proxies', proxy.id]).catch(() => {});
  }

  onSelectionChange(selected: ProxyInfo[]): void {
    this.selection.clear();
    selected.forEach(proxy => this.selection.select(proxy));
    this.selectedProxies.set([...selected]);
  }

  hasReputation(proxy: ProxyInfo): boolean {
    return this.getPrimaryReputation(proxy) !== null;
  }

  reputationBadgeClass(proxy: ProxyInfo): string {
    const label = this.getPrimaryReputation(proxy)?.label?.toLowerCase() ?? '';
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

  reputationLabel(proxy: ProxyInfo): string {
    const label = this.getPrimaryReputation(proxy)?.label?.trim();
    if (label && label.length > 0) {
      return label;
    }
    return 'Unknown';
  }

  reputationScore(proxy: ProxyInfo): string {
    const score = this.getPrimaryReputation(proxy)?.score;
    if (score === null || score === undefined) {
      return '—';
    }
    return Math.round(score).toString();
  }

  private getPrimaryReputation(proxy: ProxyInfo): ProxyReputation | null {
    const reputation = proxy.reputation;
    if (!reputation) {
      return null;
    }

    if (reputation.overall) {
      return reputation.overall;
    }

    if (reputation.protocols) {
      for (const rep of Object.values(reputation.protocols)) {
        if (rep) {
          return rep;
        }
      }
    }

    return null;
  }
}
