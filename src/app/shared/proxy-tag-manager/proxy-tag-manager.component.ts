import {HlmButton} from '@spartan-ng/helm/button';
import {HlmInput} from '@spartan-ng/helm/input';
import {DialogComponent} from '../ui/dialog.component';
import {Component, computed, EventEmitter, Input, Output, signal} from '@angular/core';
import {UpperCasePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';

import {finalize} from 'rxjs/operators';
import {ProxyTag} from '../../models/ProxyTag';
import {NotificationService} from '../../services/notification-service.service';
import {ProxyTagService} from '../../services/proxy-tag.service';
import {VisibleRowsDirective} from '../visible-rows.directive';

type TagManagerView = 'list' | 'form' | 'delete';

const DEFAULT_TAG_COLOR = '#22C55E';

@Component({
  selector: 'app-proxy-tag-manager',
  standalone: true,
  imports: [HlmButton, HlmInput, DialogComponent, FormsModule, UpperCasePipe, VisibleRowsDirective],
  templateUrl: './proxy-tag-manager.component.html',
  styleUrl: './proxy-tag-manager.component.scss',
})
export class ProxyTagManagerComponent {
  @Input() showTrigger = true;
  @Input() triggerLabel = 'Manage tags';
  @Input() triggerStyleClass = 'ui-button-outlined';

  @Output() tagsChanged = new EventEmitter<void>();

  readonly presetColors = [
    '#22C55E', '#14B8A6', '#3B82F6', '#6366F1', '#A855F7',
    '#EC4899', '#EF4444', '#F97316', '#EAB308', '#94A3B8',
  ];

  readonly visible = signal(false);
  readonly view = signal<TagManagerView>('list');
  readonly saving = signal(false);
  readonly editingTagId = signal<number | null>(null);
  readonly tagName = signal('');
  readonly tagColor = signal(DEFAULT_TAG_COLOR);
  readonly editingTag = computed(() => {
    const id = this.editingTagId();
    return id === null ? null : this.tagService.tags().find(tag => tag.id === id) ?? null;
  });

  constructor(
    readonly tagService: ProxyTagService,
    private notification: NotificationService,
  ) {}

  open(): void {
    this.showList();
    this.visible.set(true);
    this.tagService.load().subscribe({
      error: err => this.notification.showError('Could not load tags: ' + this.errorMessage(err)),
    });
  }

  close(): void {
    if (this.saving()) {
      return;
    }
    this.visible.set(false);
    this.showList();
  }

  setVisible(value: boolean): void {
    if (value) {
      this.visible.set(true);
      return;
    }
    this.close();
  }

  startCreate(): void {
    this.editingTagId.set(null);
    this.tagName.set('');
    this.tagColor.set(this.nextColor());
    this.view.set('form');
    this.focusLater('proxyTagName');
  }

  startEdit(tag: ProxyTag): void {
    this.editingTagId.set(tag.id);
    this.tagName.set(tag.name);
    this.tagColor.set(tag.color);
    this.view.set('form');
    this.focusLater('proxyTagName');
  }

  backToList(): void {
    const id = this.editingTagId();
    this.showList();
    this.focusLater(id === null ? 'tag-manager-new' : 'tag-row-' + id);
  }

  save(): void {
    if (this.saving()) {
      return;
    }
    const name = this.tagName().trim();
    if (!name) {
      this.notification.showWarn('Enter a tag name.');
      return;
    }

    const payload = {name, color: this.tagColor()};
    const editingId = this.editingTagId();
    const request = editingId
      ? this.tagService.update(editingId, payload)
      : this.tagService.create(payload);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: tag => {
        this.notification.showSuccess(editingId ? 'Tag updated.' : 'Tag created.');
        this.tagsChanged.emit();
        this.showList();
        this.focusLater(tag?.id ? 'tag-row-' + tag.id : 'tag-manager-new');
      },
      error: err => this.notification.showError('Could not save tag: ' + this.errorMessage(err)),
    });
  }

  requestDelete(): void {
    if (this.saving() || this.editingTagId() === null) {
      return;
    }
    this.view.set('delete');
  }

  cancelDelete(): void {
    this.view.set('form');
    this.focusLater('proxyTagName');
  }

  confirmDelete(): void {
    const id = this.editingTagId();
    if (this.saving() || id === null) {
      return;
    }
    this.saving.set(true);
    this.tagService.delete(id).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notification.showSuccess('Tag deleted.');
        this.tagsChanged.emit();
        this.showList();
        this.focusLater('tag-manager-new');
      },
      error: err => this.notification.showError('Could not delete tag: ' + this.errorMessage(err)),
    });
  }

  isPreset(color: string): boolean {
    return this.presetColors.some(preset => this.sameColor(preset, color));
  }

  sameColor(a: string, b: string): boolean {
    return a.toLowerCase() === b.toLowerCase();
  }

  private showList(): void {
    this.view.set('list');
    this.editingTagId.set(null);
    this.tagName.set('');
    this.tagColor.set(DEFAULT_TAG_COLOR);
  }

  /** The first preset no tag uses yet, so new tags are easy to tell apart. */
  private nextColor(): string {
    const used = this.tagService.tags().map(tag => tag.color);
    return this.presetColors.find(color => !used.some(u => this.sameColor(u, color))) ?? DEFAULT_TAG_COLOR;
  }

  // The view swap renders on the next tick, so focus waits for the current task to end.
  private focusLater(id: string): void {
    setTimeout(() => document.getElementById(id)?.focus());
  }

  private errorMessage(err: any): string {
    return err?.error?.error ?? err?.error?.message ?? err?.message ?? 'Unknown error';
  }
}
