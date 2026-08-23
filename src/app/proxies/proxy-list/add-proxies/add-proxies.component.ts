import {Component, EventEmitter, Output, computed, signal} from '@angular/core';

import {FormsModule} from "@angular/forms";
import {ProcesingPopupComponent} from './procesing-popup/procesing-popup.component';
import {Button} from 'primeng/button';
import {DialogModule} from 'primeng/dialog';
import {TooltipComponent} from '../../../tooltip/tooltip.component';
import {HttpService} from '../../../services/http.service';
import {ClipboardService} from '../../../services/clipboard.service';
import {NotificationService} from '../../../services/notification-service.service';
import {AddProxiesDetails} from '../../../models/AddProxiesResponse';

@Component({
    selector: 'app-add-proxies',
  imports: [
    FormsModule,
    TooltipComponent,
    ProcesingPopupComponent,
    Button,
    DialogModule
],
    templateUrl: './add-proxies.component.html',
    styleUrl: './add-proxies.component.scss'
})
export class AddProxiesComponent {
  private static readonly maxUploadFileBytes = 10 * 1024 * 1024;

  @Output() showAddProxiesMessage = new EventEmitter<boolean>();
  @Output() proxiesAdded = new EventEmitter<void>();

  readonly file = signal<File | undefined>(undefined);
  readonly proxyTextarea = signal<string>("");
  readonly clipboardProxies = signal<string>("");

  readonly fileProxiesNoAuthCount = signal(0);
  readonly fileProxiesWithAuthCount = signal(0);
  readonly uniqueFileProxiesCount = signal(0);

  readonly textAreaProxiesNoAuthCount = signal(0);
  readonly textAreaProxiesWithAuthCount = signal(0);
  readonly uniqueTextAreaProxiesCount = signal(0);

  readonly clipboardProxiesNoAuthCount = signal(0);
  readonly clipboardProxiesWithAuthCount = signal(0);
  readonly uniqueClipboardProxiesCount = signal(0);

  readonly dialogVisible = signal(false);
  readonly showPopup = signal(false);
  readonly popupStatus = signal<'processing' | 'success' | 'error'>('processing');
  readonly addedProxyCount = signal(0);
  readonly detailsVisible = signal(false);
  readonly uploadDetails = signal<AddProxiesDetails | null>(null);
  readonly hasUploadDetails = computed(() => this.uploadDetails() !== null);

  readonly proxiesWithoutAuthCount = computed(() =>
    this.textAreaProxiesNoAuthCount() + this.fileProxiesNoAuthCount() + this.clipboardProxiesNoAuthCount()
  );
  readonly proxiesWithAuthCount = computed(() =>
    this.textAreaProxiesWithAuthCount() + this.fileProxiesWithAuthCount() + this.clipboardProxiesWithAuthCount()
  );
  readonly uniqueProxiesCount = computed(() =>
    this.uniqueFileProxiesCount() + this.uniqueTextAreaProxiesCount() + this.uniqueClipboardProxiesCount()
  );

  constructor(
    private service: HttpService,
    private clipboardService: ClipboardService,
    private notification: NotificationService
  ) { }

  async pasteFromClipboard(): Promise<void> {
    const text = await this.clipboardService.readText();
    if (text === null) {
      this.notification.showWarn('Could not read clipboard.');
      return;
    }
    this.clipboardProxies.set(text);
    this.processClipboardProxies();
  }

  clearClipboardProxies(): void {
    this.clipboardProxies.set("");
    this.clipboardProxiesNoAuthCount.set(0);
    this.clipboardProxiesWithAuthCount.set(0);
    this.uniqueClipboardProxiesCount.set(0);
  }

  processClipboardProxies() {
    const clipboard = this.clipboardProxies();
    if (!clipboard) {
      this.clearClipboardProxies();
      return;
    }

    const summary = this.summarizeProxyInput(clipboard);
    this.clipboardProxiesNoAuthCount.set(summary.withoutAuth);
    this.clipboardProxiesWithAuthCount.set(summary.withAuth);
    this.uniqueClipboardProxiesCount.set(summary.unique);
  }

  triggerFileInput(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  openDialog(): void {
    this.dialogVisible.set(true);
  }

  closeDialog(): void {
    this.dialogVisible.set(false);
    this.resetFormState();
  }

  onDialogHide(): void {
    this.resetFormState();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.size > AddProxiesComponent.maxUploadFileBytes) {
        this.notification.showError(
          `Selected file is too large. Maximum allowed size is ${this.formatBytes(AddProxiesComponent.maxUploadFileBytes)}.`
        );
        input.value = '';
        this.onFileClear();
        return;
      }
      this.file.set(file);

      const reader = new FileReader();
      reader.onload = (_: ProgressEvent<FileReader>) => {
        const content = reader.result as string;
        const summary = this.summarizeProxyInput(content);
        this.fileProxiesNoAuthCount.set(summary.withoutAuth);
        this.fileProxiesWithAuthCount.set(summary.withAuth);
        this.uniqueFileProxiesCount.set(summary.unique);
      };

      reader.readAsText(file);
    }
  }

  onFileClear(): void {
    this.file.set(undefined);
    this.fileProxiesWithAuthCount.set(0);
    this.fileProxiesNoAuthCount.set(0);
    this.uniqueFileProxiesCount.set(0);
  }

  addTextAreaProxies() {
    const summary = this.summarizeProxyInput(this.proxyTextarea());
    this.textAreaProxiesNoAuthCount.set(summary.withoutAuth);
    this.textAreaProxiesWithAuthCount.set(summary.withAuth);
    this.uniqueTextAreaProxiesCount.set(summary.unique);
  }

  onTextareaChange(value: string) {
    this.proxyTextarea.set(value);
    this.addTextAreaProxies();
  }

  getProxiesWithoutAuthCount() {
    return this.proxiesWithoutAuthCount();
  }

  getProxiesWithAuthCount() {
    return this.proxiesWithAuthCount();
  }

  getUniqueProxiesCount() {
    return this.uniqueProxiesCount();
  }

  submitProxies() {
    if (this.file() || this.proxyTextarea() || this.clipboardProxies()) {
      this.uploadDetails.set(null);
      this.detailsVisible.set(false);
      this.showPopup.set(true);
      this.popupStatus.set('processing');

      const formData = new FormData();

      const file = this.file();
      if (file) {
        formData.append('file', file);
      } else {
        formData.append('file', '');
      }

      if (this.proxyTextarea()) {
        formData.append('proxyTextarea', this.proxyTextarea());
      }

      if (this.clipboardProxies()) {
        formData.append('clipboardProxies', this.clipboardProxies());
      }

      this.service.uploadProxies(formData).subscribe({
        next: (response) => {
          this.uploadDetails.set(response.details ?? null);
          this.addedProxyCount.set(response.proxyCount);
          this.popupStatus.set('success');
          this.dialogVisible.set(false);

          this.resetFormState();
          this.showAddProxiesMessage.emit(false);
          this.proxiesAdded.emit();
        },
        error: (err) => {
          this.popupStatus.set('error');
          this.notification.showError('Could not upload proxies: ' + this.getUploadErrorMessage(err));
        },
      });
    } else {
      console.warn('No data to submit');
    }
  }

  onPopupClose() {
    this.showPopup.set(false);
    this.uploadDetails.set(null);
    this.detailsVisible.set(false);
  }

  openDetails() {
    if (this.uploadDetails()) {
      this.detailsVisible.set(true);
    }
  }

  formatDuration(durationMs?: number | null): string {
    if (durationMs === null || durationMs === undefined) {
      return '-';
    }
    if (durationMs < 1000) {
      return `${durationMs} ms`;
    }
    return `${(durationMs / 1000).toFixed(2)} s`;
  }

  private getUploadErrorMessage(err: any): string {
    if (err?.status === 413) {
      return err?.error?.error ?? `Upload is too large. Maximum allowed size is ${this.formatBytes(AddProxiesComponent.maxUploadFileBytes)}.`;
    }
    return err?.error?.error ?? err?.error?.message ?? err?.message ?? 'Unknown error';
  }

  private formatBytes(size: number): string {
    const mb = 1024 * 1024;
    if (size % mb === 0) {
      return `${size / mb} MB`;
    }
    return `${size} bytes`;
  }

  private summarizeProxyInput(value: string): { withoutAuth: number; withAuth: number; unique: number } {
    const lines = value
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
    let withAuth = 0;
    for (const line of lines) {
      if (this.proxyLineHasAuth(line)) {
        withAuth++;
      }
    }
    return {
      withoutAuth: lines.length - withAuth,
      withAuth,
      unique: new Set(lines).size,
    };
  }

  private proxyLineHasAuth(line: string): boolean {
    if (line.includes('@')) {
      return true;
    }
    if (line.startsWith('[')) {
      const closingBracket = line.indexOf(']');
      if (closingBracket < 0) {
        return false;
      }
      return line.slice(closingBracket + 1).split(':').length >= 4;
    }
    return line.split(':').length >= 4;
  }

  private resetFormState(): void {
    this.proxyTextarea.set("");
    this.clipboardProxies.set("");
    this.file.set(undefined);
    this.onFileClear();
    this.clearClipboardProxies();
    this.addTextAreaProxies();
  }
}
