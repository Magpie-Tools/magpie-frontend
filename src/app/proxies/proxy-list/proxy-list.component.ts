import { AfterViewInit, Component, OnDestroy, OnInit, Output, EventEmitter} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpService } from '../../services/http.service';
import { ProxyInfo } from '../../models/ProxyInfo';
import { DatePipe } from '@angular/common';
import { LoadingComponent } from '../../ui-elements/loading/loading.component';
import { SelectionModel } from '@angular/cdk/collections';
import { ExportProxiesDialogComponent } from './export-proxies-dialog/export-proxies-dialog.component';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TableLazyLoadEvent } from 'primeng/table'; // Keep this for onLazyLoad
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CheckboxModule } from 'primeng/checkbox';
import {NotificationService} from '../../services/notification-service.service';
import { Subscription } from 'rxjs';

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
  ],
  templateUrl: './proxy-list.component.html',
  styleUrls: ['./proxy-list.component.scss'],
  providers: [DialogService]
})
export class ProxyListComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() showAddProxiesMessage = new EventEmitter<boolean>();

  dataSource: { data: ProxyInfo[] } = { data: [] };
  selection = new SelectionModel<ProxyInfo>(true, []);
  selectedProxies: ProxyInfo[] = [];
  page = 1;
  pageSize = 40;
  displayedColumns: string[] = ['select', 'alive', 'ip', 'port', 'response_time', 'estimated_type', 'country', 'protocol', 'latest_check'];
  totalItems = 0;
  hasLoaded = false;
  isLoading = false;

  sortField: string | null | undefined;
  sortOrder: number | undefined | null; // 1 for ascending, -1 for descending

  ref: DynamicDialogRef | undefined;
  private proxyListSubscription?: Subscription;

  constructor(private http: HttpService, public dialogService: DialogService) { }

  ngAfterViewInit() {
    // PrimeNG table handles sorting internally with pSortableColumn and (onSort)
  }

  ngOnInit(): void {
    this.getAndSetProxyCount();
    this.getAndSetProxyList();
  }

  getAndSetProxyList(event?: TableLazyLoadEvent) {
    this.proxyListSubscription?.unsubscribe();
    this.isLoading = true;
    const page = event ? Math.floor(event.first! / event.rows!) + 1 : this.page;
    const rows = event?.rows ?? this.pageSize;
    const requestedSortField = this.resolveSortField(event?.sortField);
    const requestedSortOrder = event?.sortOrder ?? this.sortOrder ?? null;
    const normalizedSortOrder = requestedSortOrder && requestedSortOrder !== 0 ? requestedSortOrder : null;
    const normalizedSortField = normalizedSortOrder ? requestedSortField : null;

    this.sortField = normalizedSortField;
    this.sortOrder = normalizedSortOrder;

    this.proxyListSubscription = this.http.getProxyPage(page, {
      rows,
    }).subscribe({
      next: res => {
        const data = [...res];
        this.page = page;
        this.pageSize = rows;
        this.dataSource.data = this.applySort(data, normalizedSortField, normalizedSortOrder);
        this.totalItems = res.length > 0 ? (this.totalItems || res.length) : 0; // fall back to current batch size until count arrives
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

  getAndSetProxyCount() {
    this.http.getProxyCount().subscribe({
      next: res => {
        this.totalItems = res;
        if (this.dataSource.data.length === 0) {
          this.hasLoaded = true;
        }
        this.showAddProxiesMessage.emit(this.totalItems === 0 && this.hasLoaded);
      },
      error: err => NotificationService.showError('Error while getting proxy count: ' + err.error.message)
    });
  }

  ngOnDestroy(): void {
    this.proxyListSubscription?.unsubscribe();
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
        error: err => NotificationService.showError('Could not delete proxies' + err.error.message)
      });
    }
  }

  openExportDialog(): void {
    this.ref = this.dialogService.open(ExportProxiesDialogComponent, {
      header: 'Export Proxies',
      width: '700px',
      height: '700px',
      data: { selectedProxies: this.selection.selected }
    });

    this.ref.onClose.subscribe({
      next: result => {
        if (result) {
          if (result.option === 'selected') {
            this.exportProxies(this.selection.selected);
          } else if (result.option === 'all') {
            this.exportProxies(this.dataSource.data);
          } else if (result.option === 'filter') {
            const filtered = this.dataSource.data.filter(proxy => {
              return proxy.ip.includes(result.criteria);
            });
            this.exportProxies(filtered);
          }
        }
      },
      error: err => NotificationService.showError('Error while closing dialog ' + err.error.message)
    });
  }

  exportProxies(proxies: ProxyInfo[]): void {
    this.handleExportRequest(proxies);
  }

  handleExportRequest(proxies: ProxyInfo[]): void {
    // Your export logic here
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
}
