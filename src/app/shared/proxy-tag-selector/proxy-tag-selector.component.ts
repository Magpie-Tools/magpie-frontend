import {BrnPopover} from '@spartan-ng/brain/popover';
import {HlmPopoverImports} from '@spartan-ng/helm/popover';
import {Component, EventEmitter, Input, Output} from '@angular/core';

import {ProxyTag} from '../../models/ProxyTag';

@Component({
  selector: 'app-proxy-tag-selector',
  standalone: true,
  imports: [HlmPopoverImports],
  templateUrl: './proxy-tag-selector.component.html',
  styleUrl: './proxy-tag-selector.component.scss',
})
export class ProxyTagSelectorComponent {
  private static nextId = 0;

  @Input() availableTags: readonly ProxyTag[] = [];
  @Input() selectedTags: readonly ProxyTag[] = [];
  @Input() disabled = false;
  @Input() saving = false;
  @Input() compact = true;
  @Input() maxVisibleTags = 2;

  @Output() selectionChange = new EventEmitter<number[]>();
  @Output() manageTags = new EventEmitter<void>();

  readonly inputPrefix = `proxy-tag-selector-${ProxyTagSelectorComponent.nextId++}`;
  draftTagIds: number[] = [];

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

  visibleTags(): ProxyTag[] {
    return this.displayTags().slice(0, Math.max(1, this.maxVisibleTags));
  }

  hiddenTagCount(): number {
    return Math.max(0, this.displayTags().length - Math.max(1, this.maxVisibleTags));
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
