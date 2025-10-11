import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {DatePipe, NgClass} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {SelectionModel} from '@angular/cdk/collections';
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
    FormsModule,
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
  selection = new SelectionModel<ScrapeSourceInfo>(true, []);
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

  onPageChange(event: PaginatorState) {
    this.page = event.page ?? 0;
    this.pageSize = event.rows ?? this.pageSize
    this.getAndSetScrapeSourcesList();
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
  }

  refreshList(): void {
    this.selection.clear();
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
  }
}
