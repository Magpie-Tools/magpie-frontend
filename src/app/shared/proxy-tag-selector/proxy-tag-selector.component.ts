import {BrnPopover} from '@spartan-ng/brain/popover';
import {HlmPopoverImports} from '@spartan-ng/helm/popover';
import {AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild, signal} from '@angular/core';

import {ProxyTag} from '../../models/ProxyTag';

@Component({
  selector: 'app-proxy-tag-selector',
  standalone: true,
  imports: [HlmPopoverImports],
  templateUrl: './proxy-tag-selector.component.html',
  styleUrl: './proxy-tag-selector.component.scss',
  host: {'[class.fit-to-width]': 'fitToWidth'},
})
export class ProxyTagSelectorComponent implements AfterViewInit, OnChanges, OnDestroy {
  private static nextId = 0;

  @Input() availableTags: readonly ProxyTag[] = [];
  @Input() selectedTags: readonly ProxyTag[] = [];
  @Input() disabled = false;
  @Input() saving = false;
  @Input() compact = true;
  @Input() maxVisibleTags = 2;
  @Input() fitToWidth = false;
  @Input() purpose: 'proxy' | 'source' = 'proxy';

  @Output() selectionChange = new EventEmitter<number[]>();
  @Output() manageTags = new EventEmitter<void>();

  readonly inputPrefix = `proxy-tag-selector-${ProxyTagSelectorComponent.nextId++}`;
  draftTagIds: number[] = [];
  private readonly fittedTagCount = signal(0);
  private viewInitialized = false;
  private resizeObserver?: ResizeObserver;
  private observedMeasurements?: HTMLElement;
  private fitFrame?: number;

  @ViewChild('tagTrigger', {static: true}) private trigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('tagChips') private chips?: ElementRef<HTMLElement>;
  @ViewChild('tagMeasurements') private measurements?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.observeSize();
  }

  ngOnChanges(): void {
    if (this.viewInitialized) {
      this.observeSize();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.fitFrame !== undefined) {
      cancelAnimationFrame(this.fitFrame);
    }
  }

  open(event: Event): void {
    event.stopPropagation();
    if (this.disabled || this.saving) {
      return;
    }
    this.draftTagIds = this.displayTags().map(tag => tag.id);

  }

  displayTags(): ProxyTag[] {
    if (this.availableTags.length === 0) {
      return [...(this.selectedTags ?? [])];
    }
    const catalog = new Map(this.availableTags.map(tag => [tag.id, tag] as const));
    return (this.selectedTags ?? [])
      .map(tag => catalog.get(tag.id) ?? tag)
      .filter(tag => catalog.has(tag.id));
  }

  candidateTags(): ProxyTag[] {
    return this.displayTags().slice(0, Math.max(1, this.maxVisibleTags));
  }

  visibleTags(): ProxyTag[] {
    const candidates = this.candidateTags();
    return this.fitToWidth ? candidates.slice(0, this.fittedTagCount()) : candidates;
  }

  hiddenTagCount(): number {
    return this.displayTags().length - this.visibleTags().length;
  }

  overflowCounts(): number[] {
    const total = this.displayTags().length;
    return Array.from({length: this.candidateTags().length + 1}, (_, index) => total - index)
      .filter(count => count > 0);
  }

  private observeSize(): void {
    if (!this.fitToWidth) {
      this.resizeObserver?.disconnect();
      this.resizeObserver = undefined;
      this.observedMeasurements = undefined;
      if (this.fitFrame !== undefined) {
        cancelAnimationFrame(this.fitFrame);
        this.fitFrame = undefined;
      }
      return;
    }
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.scheduleFit());
      this.resizeObserver.observe(this.trigger.nativeElement);
    }
    this.scheduleFit();
  }

  private scheduleFit(): void {
    if (this.fitFrame === undefined) {
      this.fitFrame = requestAnimationFrame(() => {
        this.fitFrame = undefined;
        this.fitTags();
      });
    }
  }

  private fitTags(): void {
    const measurements = this.measurements?.nativeElement;
    if (measurements !== this.observedMeasurements) {
      if (this.observedMeasurements) {
        this.resizeObserver?.unobserve(this.observedMeasurements);
      }
      this.observedMeasurements = measurements;
      if (measurements) {
        this.resizeObserver?.observe(measurements);
      }
    }

    const chips = this.chips?.nativeElement;
    if (!chips || !measurements) {
      this.fittedTagCount.set(0);
      return;
    }

    // Computed layout widths ignore the detail card's entrance scale transform.
    const availableWidth = parseFloat(getComputedStyle(chips).width);
    const gap = parseFloat(getComputedStyle(chips).columnGap) || 0;
    const total = this.displayTags().length;
    const summaryWidths = new Map(Array.from(
      measurements.querySelectorAll<HTMLElement>('.proxy-tag-selector__more'),
      summary => [Number(summary.dataset['hiddenCount']), parseFloat(getComputedStyle(summary).width)],
    ));
    let usedWidth = 0;
    let visibleCount = 0;
    measurements.querySelectorAll<HTMLElement>('.proxy-tag-chip').forEach((chip, index) => {
      usedWidth += parseFloat(getComputedStyle(chip).width) + (index > 0 ? gap : 0);
      const hiddenCount = total - index - 1;
      const requiredWidth = usedWidth + (hiddenCount > 0 ? gap + (summaryWidths.get(hiddenCount) ?? 0) : 0);
      if (requiredWidth <= availableWidth) {
        visibleCount = index + 1;
      }
    });
    this.fittedTagCount.set(visibleCount);
  }

  isSelected(tagId: number): boolean {
    return this.draftTagIds.includes(tagId);
  }

  toggleTag(tagId: number, checked: boolean): void {
    if (checked) {
      if (!this.draftTagIds.includes(tagId)) {
        this.draftTagIds = [...this.draftTagIds, tagId];
      }
      return;
    }
    this.draftTagIds = this.draftTagIds.filter(id => id !== tagId);
  }

  clear(): void {
    this.draftTagIds = [];
  }

  apply(popover: BrnPopover): void {
    this.selectionChange.emit([...this.draftTagIds]);
    popover.close();
  }

  openManager(popover: BrnPopover): void {
    popover.close();
    this.manageTags.emit();
  }
}
