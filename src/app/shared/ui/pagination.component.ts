import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmTooltip } from '@spartan-ng/helm/tooltip';
import { PageScrollTarget, readPageScrollTarget, writePageScrollTarget } from '../table-pagination';

export interface TablePageEvent {
  first?: number;
  rows?: number | null;
  sortField?: string | string[] | null;
  sortOrder?: number | null;
}
@Component({
  selector: 'app-pagination',
  imports: [HlmButton, HlmNativeSelectImports, HlmTooltip, FormsModule],
  styleUrl: './pagination.component.scss',
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
      <form class="page-jump" (submit)="jump($event)">
        <label class="page-jump__label" [attr.for]="pageJumpInputId">Page</label>
        <input
          class="page-jump__input"
          type="number"
          inputmode="numeric"
          name="pageJump"
          [id]="pageJumpInputId"
          [min]="1"
          [max]="pages"
          [disabled]="disabled || pages <= 1"
          [(ngModel)]="pageJumpValue"
          [attr.aria-describedby]="pageJumpTotalId"
        />
        <span class="page-jump__total" [id]="pageJumpTotalId">of {{ pages }}</span>
        <button type="submit" class="page-jump__submit" [disabled]="disabled || pages <= 1">Go</button>
        <button
          type="button"
          class="page-jump__scroll-toggle"
          [attr.aria-label]="pageScrollTargetLabel"
          [attr.aria-pressed]="pageScrollTarget === 'top'"
          [hlmTooltip]="pageScrollTargetLabel"
          (click)="togglePageScrollTarget()"
        >
          <i class="icon" [class.icon-arrow-up]="pageScrollTarget === 'top'"
            [class.icon-arrow-down]="pageScrollTarget === 'bottom'" aria-hidden="true"></i>
        </button>
      </form>
    </nav>
  `,
})
export class PaginationComponent implements OnChanges {
  private static nextPageJumpInputId = 0;

  @Input() first = 0;
  @Input() rows = 20;
  @Input() totalRecords = 0;
  @Input() rowsPerPageOptions: number[] = [20, 50];
  @Input() disabled = false;
  @Input() sortField: string | null = null;
  @Input() sortOrder: number | null = null;
  @Input() pageScrollTargetStorageKey: string | null = null;
  @Output() pageChange = new EventEmitter<TablePageEvent>();
  @Output() pageScrollTargetChange = new EventEmitter<PageScrollTarget>();

  readonly pageJumpInputId = `table-page-jump-${PaginationComponent.nextPageJumpInputId++}`;
  readonly pageJumpTotalId = `${this.pageJumpInputId}-total`;
  pageJumpValue: number | null = 1;
  pageScrollTarget: PageScrollTarget = 'top';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['first'] || changes['rows'] || changes['disabled']) {
      this.pageJumpValue = this.page;
    }
    if (changes['pageScrollTargetStorageKey']) {
      this.pageScrollTarget = readPageScrollTarget(this.pageScrollTargetStorageKey) ?? 'top';
      this.pageScrollTargetChange.emit(this.pageScrollTarget);
    }
  }

  get pages(): number {
    if (!Number.isFinite(this.totalRecords) || !Number.isFinite(this.rows) || this.rows <= 0) return 1;
    return Math.max(1, Math.ceil(this.totalRecords / this.rows));
  }
  get page(): number {
    return this.rows > 0 ? Math.floor(this.first / this.rows) + 1 : 1;
  }
  get last(): number {
    return Math.min(this.totalRecords, this.first + this.rows);
  }

  get pageScrollTargetLabel(): string {
    return this.pageScrollTarget === 'top' ? 'Page changes scroll to top' : 'Page changes stay at bottom';
  }

  jump(event: Event): void {
    event.preventDefault();
    if (this.disabled || this.pages <= 1) return;
    const rawPage = Number(this.pageJumpValue);
    const nextPage = Number.isFinite(rawPage) ? Math.min(this.pages, Math.max(1, Math.floor(rawPage))) : this.page;
    this.pageJumpValue = nextPage;
    if (nextPage !== this.page) this.go((nextPage - 1) * this.rows);
  }

  togglePageScrollTarget(): void {
    this.pageScrollTarget = this.pageScrollTarget === 'top' ? 'bottom' : 'top';
    writePageScrollTarget(this.pageScrollTargetStorageKey, this.pageScrollTarget);
    this.pageScrollTargetChange.emit(this.pageScrollTarget);
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
