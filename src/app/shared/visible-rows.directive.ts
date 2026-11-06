import {AfterViewInit, Directive, ElementRef, Input, OnChanges, OnDestroy} from '@angular/core';

/** Limits a vertical list whose direct children are its rows. */
@Directive({
  selector: '[appVisibleRows]',
  standalone: true,
  host: {
    style: 'overflow-y: auto; scrollbar-gutter: stable; scrollbar-width: thin;',
  },
})
export class VisibleRowsDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input('appVisibleRows') visibleRows = 3.5;

  private rows: HTMLElement[] = [];
  private rowCount = 0;
  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => this.updateHeight());
    this.mutationObserver = new MutationObserver(() => this.observeRows());
    this.mutationObserver.observe(this.elementRef.nativeElement, {childList: true});
    this.observeRows();
  }

  ngOnChanges(): void {
    if (this.resizeObserver) {
      this.observeRows();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.elementRef.nativeElement.style.removeProperty('max-height');
  }

  private observeRows(): void {
    this.resizeObserver?.disconnect();
    const children = Array.from(this.elementRef.nativeElement.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement);
    const count = Number.isFinite(this.visibleRows) && this.visibleRows > 0
      ? Math.ceil(this.visibleRows)
      : 0;
    this.rowCount = children.length;
    this.rows = children.slice(0, count);
    this.rows.forEach(row => this.resizeObserver?.observe(row));
    this.updateHeight();
  }

  private updateHeight(): void {
    const list = this.elementRef.nativeElement;
    const firstRow = this.rows[0];
    const lastRow = this.rows[this.rows.length - 1];
    if (!firstRow || !lastRow || this.rowCount <= this.visibleRows || lastRow.offsetHeight === 0) {
      list.style.removeProperty('max-height');
      return;
    }

    const fraction = this.visibleRows % 1 || 1;
    // Layout offsets ignore entrance animations and include gaps between rows.
    let height = lastRow.offsetTop - firstRow.offsetTop + lastRow.offsetHeight * fraction;
    const style = getComputedStyle(list);
    if (style.boxSizing === 'border-box') {
      height += parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
        + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    }
    list.style.maxHeight = `${height}px`;
  }
}
