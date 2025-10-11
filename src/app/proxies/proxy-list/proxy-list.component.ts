import {AfterViewInit, Component, EventEmitter, OnDestroy, OnInit, Output} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpService} from '../../services/http.service';
import {ProxyInfo} from '../../models/ProxyInfo';
import {DatePipe} from '@angular/common';
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
  ],
  templateUrl: './proxy-list.component.html',
  styleUrls: ['./proxy-list.component.scss']
})
export class ProxyListComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() showAddProxiesMessage = new EventEmitter<boolean>();

  dataSource: { data: ProxyInfo[] } = { data: [] };
  selection = new SelectionModel<ProxyInfo>(true, []);
  selectedProxies: ProxyInfo[] = [];
  page = 1;
  pageSize = 40;
  displayedColumns: string[] = ['select', 'alive', 'ip', 'port', 'response_time', 'estimated_type', 'country', 'protocol', 'latest_check', 'actions'];
  totalItems = 0;
  hasLoaded = false;
  isLoading = false;
  searchTerm = '';
  private searchDebounceHandle?: ReturnType<typeof setTimeout>;

  sortField: string | null | undefined;
  sortOrder: number | undefined | null; // 1 for ascending, -1 for descending

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
    this.isLoading = true;
    const page = event ? Math.floor((event.first ?? 0) / (event.rows ?? this.pageSize)) + 1 : this.page;
    const rows = event?.rows ?? this.pageSize;
    const requestedSortField = this.resolveSortField(event?.sortField);
    const requestedSortOrder = event?.sortOrder ?? this.sortOrder ?? null;
    const normalizedSortOrder = requestedSortOrder && requestedSortOrder !== 0 ? requestedSortOrder : null;
    const normalizedSortField = normalizedSortOrder ? requestedSortField : null;

    this.sortField = normalizedSortField;
    this.sortOrder = normalizedSortOrder;

    const trimmedSearch = this.searchTerm.trim();

    this.proxyListSubscription = this.http.getProxyPage(page, {
      rows,
      search: trimmedSearch.length > 0 ? trimmedSearch : undefined,
    }).subscribe({
      next: res => {
        const data = [...res.proxies];
        this.page = page;
        this.pageSize = rows;
        this.dataSource.data = this.applySort(data, normalizedSortField, normalizedSortOrder);
        this.totalItems = res.total ?? this.dataSource.data.length;
        this.pruneSelection();
        this.isLoading = false;
        this.hasLoaded = true;
        this.showAddProxiesMessage.emit(this.totalItems === 0 && this.hasLoaded);
      },
      error: err => {
        NotificationService.showError('Could not get proxy page: ' + err.error.message);
        this.isLoading = false;
        this.hasLoaded = true;
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
    const previousSortField = this.sortField;
    const previousSortOrder = this.sortOrder;

    const newPage = Math.floor(event.first! / event.rows!) + 1;
    const newPageSize = event.rows ?? this.pageSize;

    const normalizedSortOrder = event.sortOrder && event.sortOrder !== 0 ? event.sortOrder : null;
    const normalizedSortField = normalizedSortOrder ? this.resolveSortField(event.sortField) : null;

    const sortChanged = normalizedSortField !== previousSortField || normalizedSortOrder !== previousSortOrder;
    const pageChanged = newPage !== this.page;
    const pageSizeChanged = newPageSize !== this.pageSize;

    this.page = newPage;
    this.pageSize = newPageSize;
    this.sortField = normalizedSortField;
    this.sortOrder = normalizedSortOrder;

    if (!sortChanged && (pageChanged || pageSizeChanged)) {
      this.getAndSetProxyList(event);
    }
  }

  onSort(event: { field: string; order: number }) {
    const hasOrder = event.order !== 0 && event.order !== undefined && event.order !== null;
    this.sortField = hasOrder ? this.resolveSortField(event.field) : null;
    this.sortOrder = hasOrder ? event.order : null;
    this.dataSource.data = this.applySort([...this.dataSource.data], this.sortField, this.sortOrder);
  }

  toggleSelection(proxy: ProxyInfo): void {
    this.selection.toggle(proxy);
  }

  isAllSelected(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows && numRows > 0; // Added numRows > 0 to handle empty table case
  }

  masterToggle(): void {
    this.isAllSelected() ?
      this.selection.clear() :
      this.dataSource.data.forEach(row => this.selection.select(row));
  }

  deleteSelectedProxies(): void {
    const selectedProxies = this.selection.selected;
    if (selectedProxies.length > 0) {
      this.http.deleteProxies(selectedProxies.map(proxy => proxy.id)).subscribe({
        next: res => {
          NotificationService.showSuccess(res);
          this.totalItems -= selectedProxies.length;
          this.selection.clear();
          this.getAndSetProxyList();
        },
        error: err => {
          const message = err?.error?.message ?? err?.message ?? 'Unknown error';
          NotificationService.showError('Could not delete proxies: ' + message);
        }
      });
    }
  }

  onSearchTermChange(value: string): void {
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
    }

    this.searchTerm = value;
    this.searchDebounceHandle = setTimeout(() => {
      this.page = 1;
      this.getAndSetProxyList();
    }, 300);
  }

  private resolveSortField(sortField: TableLazyLoadEvent['sortField']): string | null {
    if (!sortField) {
      return this.sortField ?? null;
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

    if (Object.prototype.hasOwnProperty.call(proxy, field)) {
      return proxy[field as keyof ProxyInfo];
    }

    return null;
  }

  onProxiesAdded(): void {
    this.selection.clear();
    this.selectedProxies = [];
    this.page = 1;
    this.getAndSetProxyList();
  }

  private pruneSelection(): void {
    if (this.selection.isEmpty()) {
      this.selectedProxies = [];
      return;
    }

    const ids = new Set(this.dataSource.data.map(proxy => proxy.id));
    const retained = this.selection.selected.filter(proxy => ids.has(proxy.id));

    this.selection.clear();
    retained.forEach(proxy => this.selection.select(proxy));
    this.selectedProxies = [...retained];
  }

  onRowClick(_event: MouseEvent, proxy: ProxyInfo): void {
    this.router.navigate(['/proxies', proxy.id]).catch(() => {});
  }

  onViewProxy(event: Event | { originalEvent?: Event }, proxy: ProxyInfo): void {
    if (typeof (event as { originalEvent?: Event }).originalEvent !== 'undefined') {
      (event as { originalEvent?: Event }).originalEvent?.stopPropagation?.();
    } else {
      (event as Event)?.stopPropagation?.();
    }
    this.router.navigate(['/proxies', proxy.id]).catch(() => {});
  }
}
