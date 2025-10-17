import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {DatePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {SelectionModel} from '@angular/cdk/collections';
import {LoadingComponent} from '../../../ui-elements/loading/loading.component';
import {HttpService} from '../../../services/http.service';
import {ScrapeSourceInfo} from '../../../models/ScrapeSourceInfo';
import {AddScrapeSourceComponent} from '../add-scrape-source/add-scrape-source.component';

// PrimeNG imports
import {TableLazyLoadEvent, TableModule} from 'primeng/table';
import {ButtonModule} from 'primeng/button';
import {CheckboxModule} from 'primeng/checkbox';
import {ConfirmDialogModule} from 'primeng/confirmdialog';
import {ConfirmationService} from 'primeng/api';
import {NotificationService} from '../../../services/notification-service.service';

@Component({
  selector: 'app-scrape-source-list',
  imports: [
    DatePipe,
    FormsModule,
    LoadingComponent,
    TableModule,
    ButtonModule,
    CheckboxModule,
    ConfirmDialogModule,
    AddScrapeSourceComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './scrape-source-list.component.html',
  styleUrl: './scrape-source-list.component.scss'
})
export class ScrapeSourceListComponent implements OnInit {
  @Output() showAddScrapeSourceMessage = new EventEmitter<boolean>();

  scrapeSources: ScrapeSourceInfo[] = [];
  selection = new SelectionModel<ScrapeSourceInfo>(true, []);
  selectedScrapeSources: ScrapeSourceInfo[] = [];
  page = 0; // PrimeNG uses 0-based pagination
  pageSize = 20;
  totalItems = 0;
  hasLoaded = false;
  loading = false;

  constructor(
    private http: HttpService,
    private confirmationService: ConfirmationService
  ) { }

  ngOnInit(): void {
    this.getAndSetScrapeSourceCount();
    this.getAndSetScrapeSourcesList();
  }

  getAndSetScrapeSourcesList() {
    this.loading = true;
    this.http.getScrapingSourcePage(this.page + 1).subscribe({
      next: res => {
        this.scrapeSources = res;
        this.syncSelectionWithData();
        this.loading = false;
      },
      error: err => {
        NotificationService.showError("Could not get scraping sources" + err.error.message);
        this.loading = false;
      }
    });
  }

  getAndSetScrapeSourceCount() {
    this.http.getScrapingSourcesCount().subscribe({
      next: res => {
        this.totalItems = res;
        this.hasLoaded = true;
        this.showAddScrapeSourceMessage.emit(this.totalItems === 0 && this.hasLoaded);
      },
      error: err => NotificationService.showError("Could not get scrape sources count " + err.error.message)
    });
  }

  onLazyLoad(event: TableLazyLoadEvent) {
    const newPage = Math.floor((event.first ?? 0) / (event.rows ?? this.pageSize));
    const newPageSize = event.rows ?? this.pageSize;

    const shouldFetch = newPage !== this.page || newPageSize !== this.pageSize;

    this.page = newPage;
    this.pageSize = newPageSize;

    if (shouldFetch) {
      this.getAndSetScrapeSourcesList();
    }
  }

  deleteSelectedSources(): void {
    const selected = [...this.selection.selected];
    if (selected.length === 0) {
      return;
    }

    this.confirmationService.confirm({
      message: `Are you sure you want to delete ${selected.length} selected scrape source(s)?`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const selectedIds = selected.map(source => source.id);

        this.http.deleteScrapingSource(selectedIds).subscribe({
          next: res => {
            NotificationService.showSuccess(res);
            this.totalItems -= selected.length;
            this.selection.clear();
            this.selectedScrapeSources = [];
            this.getAndSetScrapeSourcesList();
          },
          error: err => NotificationService.showError("Could not delete scraping source " + err.error.message)
        });
      }
    });
  }

  // Helper method to get selection count
  getSelectionCount(): number {
    return this.selection.selected.length;
  }

  toggleSelection(source: ScrapeSourceInfo): void {
    this.selection.toggle(source);
    this.selectedScrapeSources = [...this.selection.selected];
  }

  isAllSelected(): boolean {
    return this.scrapeSources.length > 0 && this.selection.selected.length === this.scrapeSources.length;
  }

  isSomeSelected(): boolean {
    const count = this.selection.selected.length;
    return count > 0 && count < this.scrapeSources.length;
  }

  masterToggle(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.scrapeSources.forEach(source => this.selection.select(source));
    }
    this.selectedScrapeSources = [...this.selection.selected];
  }

  refreshList(): void {
    this.selection.clear();
    this.selectedScrapeSources = [];
    this.getAndSetScrapeSourceCount();
    this.getAndSetScrapeSourcesList();
  }

  onScrapeSourcesAdded(): void {
    this.page = 0;
    this.refreshList();
  }

  onShowAddScrapeSourcesMessage(value: boolean): void {
    this.showAddScrapeSourceMessage.emit(value);
  }

  private syncSelectionWithData(): void {
    const selectedIds = new Set(this.selection.selected.map(source => source.id));
    this.selection.clear();

    this.scrapeSources.forEach(source => {
      if (selectedIds.has(source.id)) {
        this.selection.select(source);
      }
    });
    this.selectedScrapeSources = [...this.selection.selected];
  }
}
