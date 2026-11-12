import {Component, EventEmitter, Input, Output} from '@angular/core';
import {DecimalPipe} from '@angular/common';

@Component({
  selector: 'app-inventory-page-shell',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './inventory-page-shell.component.html',
  styleUrl: './inventory-page-shell.component.scss',
})
export class InventoryPageShellComponent {
  @Input() embedded = false;
  @Input() showPageHeading = true;
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
  /** Plural noun for the summary line, such as "proxies". */
  @Input() itemNoun = 'items';
  /** Singular of `itemNoun`, such as "proxy". */
  @Input() itemNounSingular = 'item';
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
  @Output() clearSelection = new EventEmitter<void>();

  nounFor(count: number): string {
    return count === 1 ? this.itemNounSingular : this.itemNoun;
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
