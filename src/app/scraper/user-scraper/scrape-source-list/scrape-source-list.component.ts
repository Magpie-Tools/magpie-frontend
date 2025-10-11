import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {DatePipe, NgClass} from '@angular/common';
import {LoadingComponent} from '../../../ui-elements/loading/loading.component';
import {HttpService} from '../../../services/http.service';
import {ScrapeSourceInfo} from '../../../models/ScrapeSourceInfo';
import {AddScrapeSourceComponent} from '../add-scrape-source/add-scrape-source.component';

// PrimeNG imports
import {TableModule} from 'primeng/table';
import {ButtonModule} from 'primeng/button';
import {CheckboxModule} from 'primeng/checkbox';
import {PaginatorModule, PaginatorState} from 'primeng/paginator';
import {TooltipModule} from 'primeng/tooltip';
import {ConfirmDialogModule} from 'primeng/confirmdialog';
import {ConfirmationService} from 'primeng/api';
import {NotificationService} from '../../../services/notification-service.service';

@Component({
  selector: 'app-scrape-source-list',
  imports: [
    DatePipe,
    LoadingComponent,
    TableModule,
    ButtonModule,
    CheckboxModule,
    PaginatorModule,
    TooltipModule,
    ConfirmDialogModule,
    NgClass,
    AddScrapeSourceComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './scrape-source-list.component.html',
  styleUrl: './scrape-source-list.component.scss'
})
export class ScrapeSourceListComponent implements OnInit {
  @Output() showAddScrapeSourceMessage = new EventEmitter<boolean>();

  scrapeSources: ScrapeSourceInfo[] = [];
  selectedSources: ScrapeSourceInfo[] = [];
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

  onPageChange(event: PaginatorState) {
    this.page = event.page ?? 0;
    this.pageSize = event.rows ?? this.pageSize
    this.getAndSetScrapeSourcesList();
  }

  // Select all functionality
  onSelectAll(event: any) {
    if (event.checked) {
      this.selectedSources = [...this.scrapeSources];
    } else {
      this.selectedSources = [];
    }
  }

  // Check if all rows are selected
  isAllSelected(): boolean {
    return this.scrapeSources.length > 0 && this.selectedSources.length === this.scrapeSources.length;
  }

  // Check if some rows are selected (for indeterminate state)
  isSomeSelected(): boolean {
    return this.selectedSources.length > 0 && this.selectedSources.length < this.scrapeSources.length;
  }

  deleteSelectedSources(): void {
    if (this.selectedSources.length === 0) return;

    this.confirmationService.confirm({
      message: `Are you sure you want to delete ${this.selectedSources.length} selected scrape source(s)?`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const selectedIds = this.selectedSources.map(source => source.id);

        this.http.deleteScrapingSource(selectedIds).subscribe({
          next: res => {
            NotificationService.showSuccess(res);
            this.totalItems -= this.selectedSources.length;
            this.selectedSources = [];
            this.getAndSetScrapeSourcesList();
          },
          error: err => NotificationService.showError("Could not delete scraping source " + err.error.message)
        });
      }
    });
  }

  // Helper method to get selection count
  getSelectionCount(): number {
    return this.selectedSources.length;
  }

  refreshList(): void {
    this.selectedSources = [];
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
}
