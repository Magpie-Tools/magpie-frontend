import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
export interface TablePageEvent {
  first?: number;
  rows?: number | null;
  sortField?: string | string[] | null;
  sortOrder?: number | null;
}
@Component({
  selector: 'app-pagination',
  imports: [HlmButton, HlmNativeSelectImports, FormsModule],
  template: `
    <nav class="table-pagination" aria-label="Table pagination">
      <span role="status"
        >{{ totalRecords === 0 ? 0 : first + 1 }}–{{ last }} of
        {{ totalRecords }}</span
      >
      <div class="flex items-center gap-2">
        <button
          hlmBtn
          type="button"
          variant="outline"
          size="sm"
          aria-label="First page"
          [disabled]="disabled || first <= 0"
          (click)="go(0)"
        >
          «
        </button>
        <button
          hlmBtn
          type="button"
          variant="outline"
          size="sm"
          aria-label="Previous page"
          [disabled]="disabled || first <= 0"
          (click)="go(first - rows)"
        >
          Previous
        </button>
        <button
          hlmBtn
          type="button"
          variant="outline"
          size="sm"
          aria-label="Next page"
          [disabled]="disabled || last >= totalRecords"
          (click)="go(first + rows)"
        >
          Next
        </button>
        <button
          hlmBtn
          type="button"
          variant="outline"
          size="sm"
          aria-label="Last page"
          [disabled]="disabled || last >= totalRecords"
          (click)="go((pages - 1) * rows)"
        >
          »
        </button>
        <label class="flex items-center gap-2"
          ><span class="sr-only">Rows per page</span
          ><hlm-native-select
            [ngModel]="rows"
            (ngModelChange)="resize($event)"
            [disabled]="disabled"
          >
            @for (size of rowsPerPageOptions; track size) {
              <option hlmNativeSelectOption [value]="size">
                {{ size }} per page
              </option>
            }
          </hlm-native-select></label
        >
      </div>
      <ng-content />
    </nav>
  `,
})
export class PaginationComponent {
  @Input() first = 0;
  @Input() rows = 20;
  @Input() totalRecords = 0;
  @Input() rowsPerPageOptions: number[] = [20, 50];
  @Input() disabled = false;
  @Input() sortField: string | null = null;
  @Input() sortOrder: number | null = null;
  @Output() pageChange = new EventEmitter<TablePageEvent>();
  get pages(): number {
    return Math.max(1, Math.ceil(this.totalRecords / this.rows));
  }
  get last(): number {
    return Math.min(this.totalRecords, this.first + this.rows);
  }
  go(first: number): void {
    if (this.disabled) return;
    this.pageChange.emit({
      first: Math.max(0, Math.min(first, (this.pages - 1) * this.rows)),
      rows: this.rows,
      sortField: this.sortField,
      sortOrder: this.sortOrder,
    });
  }
  resize(raw: string | number): void {
    const rows = Number(raw);
    if (this.disabled || !this.rowsPerPageOptions.includes(rows)) return;
    this.pageChange.emit({
      first: 0,
      rows,
      sortField: this.sortField,
      sortOrder: this.sortOrder,
    });
  }
}
