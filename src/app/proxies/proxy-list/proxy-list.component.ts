import {AfterViewInit, Component, OnInit, ViewChild} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpService} from '../../services/http.service';
import {ProxyInfo} from '../../models/ProxyInfo';
import {MatSort, MatSortModule} from '@angular/material/sort';
import {MatPaginator, PageEvent} from '@angular/material/paginator';
import {DatePipe} from '@angular/common';

import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow, MatHeaderRowDef, MatRow, MatRowDef,
  MatTable, MatTableDataSource
} from '@angular/material/table';

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
    MatHeaderRowDef
  ],
  templateUrl: './proxy-list.component.html',
  styleUrl: './proxy-list.component.scss'
})
export class ProxyListComponent implements OnInit, AfterViewInit {
  dataSource = new MatTableDataSource<ProxyInfo>([]);
  page = 1;
  displayedColumns: string[] = ['alive', 'ip', 'response_time', 'estimated_type', 'country', 'protocol', 'latest_check'];
  totalItems = 0;

  @ViewChild(MatSort) sort!: MatSort;

  constructor(private http: HttpService) {
  }

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
    this.getAndSetProxyCount()
    this.getAndSetProxyList()
  }

  getAndSetProxyList() {
    this.http.getProxyPage(this.page).subscribe(res => {
      this.dataSource.data = res;
    });
  }

  getAndSetProxyCount() {
    this.http.getProxyCount().subscribe(res => {
      this.totalItems = res
    })
  }

  onPageChange(event: PageEvent) {
    this.page = event.pageIndex + 1;
    this.getAndSetProxyList();
  }
}
