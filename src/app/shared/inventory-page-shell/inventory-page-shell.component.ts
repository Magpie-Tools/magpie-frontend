import {Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
  selector: 'app-inventory-page-shell',
  standalone: true,
  templateUrl: './inventory-page-shell.component.html',
  styleUrl: './inventory-page-shell.component.scss',
})
export class InventoryPageShellComponent {
  @Input() pageIcon = '';
  @Input() pageTitle = '';
  @Input() pageDescription = '';
  @Input() toolbarTitle = '';
  @Input() toolbarDescription = '';
  @Input() toolbarAriaLabel = '';
  @Input() searchTerm = '';
  @Input() searchPlaceholder = '';
  @Input() searchAriaLabel = '';
  @Input() resultIcon = '';
  @Input() resultTitle = '';
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
