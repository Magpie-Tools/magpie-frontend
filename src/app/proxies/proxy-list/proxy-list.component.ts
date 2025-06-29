import { AfterViewInit, Component, OnInit, Output, ViewChild, EventEmitter } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpService } from '../../services/http.service';
import { ProxyInfo } from '../../models/ProxyInfo';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { DatePipe } from '@angular/common';
import { LoadingComponent } from '../../ui-elements/loading/loading.component';
import { SelectionModel } from '@angular/cdk/collections';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
  MatTableDataSource
} from '@angular/material/table';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { SnackbarService } from '../../services/snackbar.service';
import { MatDialog } from '@angular/material/dialog';
import {ExportProxiesDialogComponent} from './export-proxies-dialog/export-proxies-dialog.component';

@Component({
  selector: 'app-proxy-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    MatCellDef,
    MatCell,
    MatHeaderCellDef,
    MatHeaderCell,
    MatColumnDef,
    MatTable,
    MatSortModule,
    MatPaginator,
    MatHeaderRow,
    MatRow,
    DatePipe,
    MatRowDef,
    MatHeaderRowDef,
    LoadingComponent,
    MatButton,
    MatCheckbox
  ],
  templateUrl: './proxy-list.component.html',
  styleUrls: ['./proxy-list.component.scss']
})
export class ProxyListComponent implements OnInit, AfterViewInit {
  @Output() showAddProxiesMessage = new EventEmitter<boolean>();

  dataSource = new MatTableDataSource<ProxyInfo>([]);
  selection = new SelectionModel<ProxyInfo>(true, []);
  page = 1;
  displayedColumns: string[] = ['select', 'alive', 'ip', 'port', 'response_time', 'estimated_type', 'country', 'protocol', 'latest_check'];
  totalItems = 0;
  hasLoaded = false;

  @ViewChild(MatSort) sort!: MatSort;

  constructor(private http: HttpService, private dialog: MatDialog) { }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (item, property) => {
      if (property === 'alive') {
        return item.alive ? 0 : 1;
      }
      return item[property as keyof ProxyInfo] as any;
    };
  }

  ngOnInit(): void {
    this.getAndSetProxyCount();
    this.getAndSetProxyList();
  }

  getAndSetProxyList() {
    this.http.getProxyPage(this.page).subscribe(res => {
      this.dataSource.data = res;
    });
  }

  getAndSetProxyCount() {
    this.http.getProxyCount().subscribe(res => {
      this.totalItems = res;
      this.hasLoaded = true;
      this.showAddProxiesMessage.emit(this.totalItems === 0 && this.hasLoaded);

      setTimeout(() => {
        if (this.sort) {
          this.dataSource.sort = this.sort;
          this.dataSource.sortingDataAccessor = (item, property) => {
            if (property === 'alive') {
              return item.alive ? 0 : 1;
            }
            return item[property as keyof ProxyInfo] as any;
          };
        }
      });
    });
  }

  onPageChange(event: PageEvent) {
    this.page = event.pageIndex + 1;
    this.getAndSetProxyList();
  }

  // Toggle the selection for a given proxy
  toggleSelection(proxy: ProxyInfo): void {
    this.selection.toggle(proxy);
  }

  // Whether the number of selected elements matches the total number of rows.
  isAllSelected(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  // Selects all rows if they are not all selected; otherwise clear selection.
  masterToggle(): void {
    this.isAllSelected() ?
      this.selection.clear() :
      this.dataSource.data.forEach(row => this.selection.select(row));
  }

  deleteSelectedProxies(): void {
    const selectedProxies = this.selection.selected;
    if (selectedProxies.length > 0) {
      this.http.deleteProxies(selectedProxies.map(proxy => proxy.id)).subscribe(res => {
        SnackbarService.openSnackbar(res, 3000);
        this.totalItems -= selectedProxies.length;
      });
      this.selection.clear();
      this.getAndSetProxyList();
    }
  }

  openExportDialog(): void {
    const dialogRef = this.dialog.open(ExportProxiesDialogComponent, {
      width: '700px',
      height: "700px",
      data: { selectedProxies: this.selection.selected }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Determine which proxies to export based on the user's choice
        if (result.option === 'selected') {
          this.exportProxies(this.selection.selected);
        } else if (result.option === 'all') {
          this.exportProxies(this.dataSource.data);
        } else if (result.option === 'filter') {
          const filtered = this.dataSource.data.filter(proxy => {
            // Example filter: check if the proxy's IP address includes the filter criteria
            return proxy.ip.includes(result.criteria);
          });
          this.exportProxies(filtered);
        }
      }
    });
  }

  exportProxies(proxies: ProxyInfo[]): void {
    this.handleExportRequest(proxies);
  }

  handleExportRequest(proxies: ProxyInfo[]): void {

  }
}
