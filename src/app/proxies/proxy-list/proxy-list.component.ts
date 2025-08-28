import { AfterViewInit, Component, OnInit, Output, EventEmitter, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpService } from '../../services/http.service';
import { ProxyInfo } from '../../models/ProxyInfo';
import { DatePipe } from '@angular/common';
import { LoadingComponent } from '../../ui-elements/loading/loading.component';
import { SelectionModel } from '@angular/cdk/collections';
import { SnackbarService } from '../../services/snackbar.service';
import { ExportProxiesDialogComponent } from './export-proxies-dialog/export-proxies-dialog.component';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TableLazyLoadEvent } from 'primeng/table'; // Keep this for onLazyLoad
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CheckboxModule } from 'primeng/checkbox';

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
export class ProxyListComponent implements OnInit, AfterViewInit {
  @Output() showAddProxiesMessage = new EventEmitter<boolean>();

  dataSource: { data: ProxyInfo[] } = { data: [] };
  selection = new SelectionModel<ProxyInfo>(true, []);
  selectedProxies: ProxyInfo[] = [];
  page = 1;
  pageSize = 40;
  displayedColumns: string[] = ['select', 'alive', 'ip', 'port', 'response_time', 'estimated_type', 'country', 'protocol', 'latest_check'];
  totalItems = 0;
  hasLoaded = false;

  sortField: string | null | undefined;
  sortOrder: number | undefined | null; // 1 for ascending, -1 for descending

  ref: DynamicDialogRef | undefined;

  constructor(private http: HttpService, public dialogService: DialogService) { }

  ngAfterViewInit() {
    // PrimeNG table handles sorting internally with pSortableColumn and (onSort)
  }

  ngOnInit(): void {
    this.getAndSetProxyCount();
    this.getAndSetProxyList();
  }

  getAndSetProxyList(event?: TableLazyLoadEvent) {
    this.hasLoaded = false;
    const page = event ? Math.floor(event.first! / event.rows!) + 1 : this.page;
    const rows = event ? event.rows : this.pageSize;
    const sortField = event?.sortField || this.sortField;
    const sortOrder = event?.sortOrder || this.sortOrder;

    this.http.getProxyPage(page).subscribe({
      next: res => {
        this.dataSource.data = res;
        this.totalItems = res.length > 0 ? this.totalItems : 0; // Adjust totalItems if data is empty after filter/sort
        this.hasLoaded = true;
        this.showAddProxiesMessage.emit(this.totalItems === 0 && this.hasLoaded);
      },
      error: err => {
        SnackbarService.openSnackbarDefault('Could not get proxy page: ' + err.error.message);
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
      error: err => SnackbarService.openSnackbarDefault('Error while getting proxy count: ' + err.error.message)
    });
  }

  onLazyLoad(event: TableLazyLoadEvent) {
    this.page = Math.floor(event.first! / event.rows!) + 1;
    this.pageSize = event.rows!;
    this.sortField = this.sortField = Array.isArray(event.sortField)
      ? event.sortField[0]
      : event.sortField ?? null;
    this.sortOrder = event.sortOrder;
    this.getAndSetProxyList(event);
  }

  // Corrected onSort method
  onSort(event: { field: string; order: number }) {
    this.sortField = event.field;
    this.sortOrder = event.order;
    // Trigger a lazy load to re-fetch data with new sort parameters
    this.getAndSetProxyList({
      first: (this.page - 1) * this.pageSize,
      rows: this.pageSize,
      sortField: this.sortField,
      sortOrder: this.sortOrder,
      globalFilter: null,
      filters: {},
      multiSortMeta: undefined
    });
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
          SnackbarService.openSnackbar(res, 3000);
          this.totalItems -= selectedProxies.length;
          this.selection.clear();
          this.getAndSetProxyList();
        },
        error: err => SnackbarService.openSnackbarDefault('Could not delete proxies' + err.error.message)
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
      error: err => SnackbarService.openSnackbarDefault('Error while closing dialog ' + err.error.message)
    });
  }

  exportProxies(proxies: ProxyInfo[]): void {
    this.handleExportRequest(proxies);
  }

  handleExportRequest(proxies: ProxyInfo[]): void {
    // Your export logic here
  }
}
