import {Component, EventEmitter, Input, Output, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ButtonModule} from 'primeng/button';
import {DialogModule} from 'primeng/dialog';
import {finalize} from 'rxjs/operators';
import {ProxyTag} from '../../models/ProxyTag';
import {NotificationService} from '../../services/notification-service.service';
import {ProxyTagService} from '../../services/proxy-tag.service';

@Component({
  selector: 'app-proxy-tag-manager',
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule],
  templateUrl: './proxy-tag-manager.component.html',
  styleUrl: './proxy-tag-manager.component.scss',
})
export class ProxyTagManagerComponent {
  @Input() showTrigger = true;
  @Input() triggerLabel = 'Manage tags';
  @Input() triggerStyleClass = 'p-button-outlined';

  @Output() tagsChanged = new EventEmitter<void>();

  readonly visible = signal(false);
  readonly saving = signal(false);
  readonly deletingTagId = signal<number | null>(null);
  readonly editingTagId = signal<number | null>(null);
  readonly tagName = signal('');
  readonly tagColor = signal('#22C55E');

  constructor(
    readonly tagService: ProxyTagService,
    private notification: NotificationService,
  ) {}

  open(): void {
    this.visible.set(true);
    this.tagService.load().subscribe({
      error: err => this.notification.showError('Could not load tags: ' + this.errorMessage(err)),
    });
  }

  close(): void {
    this.visible.set(false);
    this.resetEditor();
    this.deletingTagId.set(null);
  }

  setVisible(value: boolean): void {
    if (value) {
      this.visible.set(true);
      return;
    }
    this.close();
  }

  edit(tag: ProxyTag): void {
    if (this.saving()) {
      return;
    }
    this.editingTagId.set(tag.id);
    this.tagName.set(tag.name);
    this.tagColor.set(tag.color);
    this.deletingTagId.set(null);
  }

  cancelEdit(): void {
    this.resetEditor();
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
      next: () => {
        this.notification.showSuccess(editingId ? 'Tag updated.' : 'Tag created.');
        this.resetEditor();
        this.tagsChanged.emit();
      },
      error: err => this.notification.showError('Could not save tag: ' + this.errorMessage(err)),
    });
  }

  requestDelete(tag: ProxyTag): void {
    if (this.saving()) {
      return;
    }
    this.deletingTagId.set(tag.id);
  }

  cancelDelete(): void {
    this.deletingTagId.set(null);
  }

  confirmDelete(tag: ProxyTag): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.tagService.delete(tag.id).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        if (this.editingTagId() === tag.id) {
          this.resetEditor();
        }
        this.deletingTagId.set(null);
        this.notification.showSuccess('Tag deleted.');
        this.tagsChanged.emit();
      },
      error: err => this.notification.showError('Could not delete tag: ' + this.errorMessage(err)),
    });
  }

  private resetEditor(): void {
    this.editingTagId.set(null);
    this.tagName.set('');
    this.tagColor.set('#22C55E');
  }

  private errorMessage(err: any): string {
    return err?.error?.error ?? err?.error?.message ?? err?.message ?? 'Unknown error';
  }
}
