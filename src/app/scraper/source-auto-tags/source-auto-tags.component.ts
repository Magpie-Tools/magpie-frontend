import {Component, EventEmitter, Input, Output} from '@angular/core';
import {ProxyTagService} from '../../services/proxy-tag.service';
import {ProxyTagSelectorComponent} from '../../shared/proxy-tag-selector/proxy-tag-selector.component';
import {ProxyTagManagerComponent} from '../../shared/proxy-tag-manager/proxy-tag-manager.component';

@Component({
  selector: 'app-source-auto-tags',
  standalone: true,
  imports: [ProxyTagSelectorComponent, ProxyTagManagerComponent],
  templateUrl: './source-auto-tags.component.html',
  styleUrl: './source-auto-tags.component.scss',
})
export class SourceAutoTagsComponent {
  @Input() tagIds: readonly number[] = [];
  @Input() disabled = false;
  @Input() saving = false;
  @Input() forImport = false;
  @Output() tagIdsChange = new EventEmitter<number[]>();
  @Output() catalogChanged = new EventEmitter<void>();

  constructor(readonly tagService: ProxyTagService) {}

  selectedTags() {
    const selected = new Set(this.tagIds);
    return this.tagService.tags().filter(tag => selected.has(tag.id));
  }

  onCatalogChanged(): void {
    const valid = new Set(this.tagService.tags().map(tag => tag.id));
    const ids = this.tagIds.filter(id => valid.has(id));
    if (ids.length !== this.tagIds.length) {
      this.tagIdsChange.emit(ids);
    }
    this.catalogChanged.emit();
  }
}
