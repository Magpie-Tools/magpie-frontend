import {Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {RevealGroupDirective} from '../reveal-group.directive';

@Component({
  selector: 'app-inventory-page-shell',
  standalone: true,
  imports: [RevealGroupDirective],
  templateUrl: './inventory-page-shell.component.html',
  styleUrl: './inventory-page-shell.component.scss',
})
export class InventoryPageShellComponent implements OnChanges {
  @Input() pageIcon = '';
  @Input() pageTitle = '';
  @Input() pageDescription = '';
  @Input() toolbarTitle = '';
  @Input() combinedCard = false;
  @Input() toolbarDescription = '';
  @Input() toolbarAriaLabel = '';
  @Input() searchTerm = '';
  @Input() searchPlaceholder = '';
  @Input() searchAriaLabel = '';
  @Input() resultIcon = '';
  @Input() resultTitle = '';
  @Input() showResultHeading = true;
  @Input() resultDescription = '';
  @Input() selectedCount = 0;
  @Input() totalItems = 0;
  @Input() hasLoaded = false;
  @Input() loading = false;
  @Input() loadingLabel = 'Loading';
  @Input() activeFilters = false;
  @Input() emptyTitle = '';
  @Input() filteredEmptyTitle = '';
  @Input() emptyDescription = '';
  @Input() filteredEmptyDescription = 'Clear the search or filters to widen the result set.';

  @Output() searchTermChange = new EventEmitter<string>();
  @Output() clearSearch = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();

  initialLoadComplete = false;

  ngOnChanges(): void {
    // Keep later refreshes from hiding the page or replaying its entrance.
    if (this.hasLoaded && !this.loading) {
      this.initialLoadComplete = true;
    }
  }

  get isEmpty(): boolean {
    return this.hasLoaded && !this.loading && this.totalItems === 0;
  }

  get isFiltered(): boolean {
    return !!this.searchTerm || this.activeFilters;
  }

  onSearchInput(event: Event): void {
    this.searchTermChange.emit((event.target as HTMLInputElement).value);
  }
}
