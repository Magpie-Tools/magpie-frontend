import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Popover} from 'primeng/popover';
import {ProxyTag} from '../../models/ProxyTag';

@Component({
  selector: 'app-proxy-tag-selector',
  standalone: true,
  imports: [Popover],
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

  open(event: Event, popover: Popover): void {
    event.stopPropagation();
    if (this.disabled || this.saving) {
      return;
    }
    this.draftTagIds = this.displayTags().map(tag => tag.id);
    popover.toggle(event);
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

  apply(popover: Popover): void {
    this.selectionChange.emit([...this.draftTagIds]);
    popover.hide();
  }

  openManager(popover: Popover): void {
    popover.hide();
    this.manageTags.emit();
  }
}
