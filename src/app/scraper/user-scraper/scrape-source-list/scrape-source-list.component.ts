import {AfterViewInit, Component, EventEmitter, OnInit, Output, ViewChild} from '@angular/core';
import {DatePipe} from '@angular/common';
import {LoadingComponent} from '../../../ui-elements/loading/loading.component';
import {MatButton} from '@angular/material/button';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell, MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow, MatRowDef, MatTable, MatTableDataSource
} from '@angular/material/table';
import {MatCheckbox} from '@angular/material/checkbox';
import {MatPaginator, PageEvent} from '@angular/material/paginator';
import {MatSort, MatSortHeader} from '@angular/material/sort';
import {SelectionModel} from '@angular/cdk/collections';
import {HttpService} from '../../../services/http.service';
import {SnackbarService} from '../../../services/snackbar.service';
import {ScrapeSourceInfo} from '../../../models/ScrapeSourceInfo';

@Component({
    selector: 'app-scrape-source-list',
    imports: [
        DatePipe,
        LoadingComponent,
        MatButton,
        MatCell,
        MatCellDef,
        MatCheckbox,
        MatColumnDef,
        MatHeaderCell,
        MatHeaderRow,
        MatHeaderRowDef,
        MatPaginator,
        MatRow,
        MatRowDef,
        MatSort,
        MatSortHeader,
        MatTable,
        MatHeaderCellDef
    ],
    templateUrl: './scrape-source-list.component.html',
    styleUrl: './scrape-source-list.component.scss'
})
export class ScrapeSourceListComponent implements OnInit, AfterViewInit {
  @Output() showAddScrapeSourceMessage = new EventEmitter<boolean>();

  dataSource = new MatTableDataSource<ScrapeSourceInfo>([]);
  selection = new SelectionModel<ScrapeSourceInfo>(true, []);
  page = 1;
  displayedColumns: string[] = ['select', 'url', 'proxy_count', 'added_at'];
  totalItems = 0;
  hasLoaded = false;

  @ViewChild(MatSort) sort!: MatSort;

  constructor(private http: HttpService) { }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (item, property) => {
      return item[property as keyof ScrapeSourceInfo] as any;
    };
  }

  ngOnInit(): void {
    this.getAndSetScrapeSourceCount();
    this.getAndSetScrapeSourcesList();
  }

  getAndSetScrapeSourcesList() {
    this.http.getScrapingSourcePage(this.page).subscribe({
      next: res => {
        this.dataSource.data = res;
      }, error: err => SnackbarService.openSnackbarDefault("Could not get scraping sources" + err.error.message)
    });
  }

  getAndSetScrapeSourceCount() {
    this.http.getScrapingSourcesCount().subscribe({
      next: res => {
        this.totalItems = res;
        this.hasLoaded = true;
        this.showAddScrapeSourceMessage.emit(this.totalItems === 0 && this.hasLoaded);

        setTimeout(() => {
          if (this.sort) {
            this.dataSource.sort = this.sort;
          }
        });
      }, error: err => SnackbarService.openSnackbarDefault("Could not get scrape sources count " + err.error.message)
    });
  }

  onPageChange(event: PageEvent) {
    this.page = event.pageIndex + 1;
    this.getAndSetScrapeSourcesList();
  }

  toggleSelection(scrapeSource: ScrapeSourceInfo): void {
    this.selection.toggle(scrapeSource);
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

  deleteSelectedSources(): void {
    const selectedProxies = this.selection.selected;
    if (selectedProxies.length > 0) {
      this.http.deleteScrapingSource(selectedProxies.map(proxy => proxy.id)).subscribe({
        next: res => {
          SnackbarService.openSnackbar(res, 3000);
          this.totalItems -= selectedProxies.length;
        }, error: err => SnackbarService.openSnackbarDefault("Could not delete scraping source "+ err.error.message)
      });
      this.selection.clear();
      this.getAndSetScrapeSourcesList();
    }
  }
}
