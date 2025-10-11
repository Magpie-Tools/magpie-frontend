import {Component, EventEmitter, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from "@angular/forms";
import {ProcesingPopupComponent} from './procesing-popup/procesing-popup.component';
import {Button} from 'primeng/button';
import {DialogModule} from 'primeng/dialog';
import {TooltipComponent} from '../../../tooltip/tooltip.component';
import {HttpService} from '../../../services/http.service';
import {NotificationService} from '../../../services/notification-service.service';

@Component({
    selector: 'app-add-proxies',
  imports: [
    CommonModule,
    FormsModule,
    TooltipComponent,
    ProcesingPopupComponent,
    Button,
    DialogModule,
  ],
    templateUrl: './add-proxies.component.html',
    styleUrl: './add-proxies.component.scss'
})
export class AddProxiesComponent {
  @Output() showAddProxiesMessage = new EventEmitter<boolean>();
  @Output() proxiesAdded = new EventEmitter<void>();

  file: File | undefined;
  ProxyTextarea: string = "";
  clipboardProxies: string = "";

  fileProxiesNoAuthCount: number = 0;
  fileProxiesWithAuthCount: number = 0;
  uniqueFileProxiesCount: number = 0;

  textAreaProxiesNoAuthCount: number = 0;
  textAreaProxiesWithAuthCount: number = 0;
  uniqueTextAreaProxiesCount: number = 0;

  clipboardProxiesNoAuthCount: number = 0;
  clipboardProxiesWithAuthCount: number = 0;
  uniqueClipboardProxiesCount: number = 0;

  dialogVisible = false;
  showPopup = false;
  popupStatus: 'processing' | 'success' | 'error' = 'processing';
  addedProxyCount = 0;

  constructor(private service: HttpService) { }

  async pasteFromClipboard(): Promise<void> {
    try {
      this.clipboardProxies = await navigator.clipboard.readText();
      this.processClipboardProxies();
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  }

  clearClipboardProxies(): void {
    this.clipboardProxies = "";
    this.clipboardProxiesNoAuthCount = 0;
    this.clipboardProxiesWithAuthCount = 0;
    this.uniqueClipboardProxiesCount = 0;
  }

  processClipboardProxies() {
    if (!this.clipboardProxies) {
      this.clearClipboardProxies();
      return;
    }

    const lines = this.clipboardProxies.split(/\r?\n/);
    const proxies = lines.filter(line => (line.match(/:/g) || []).length === 1);

    this.clipboardProxiesNoAuthCount = proxies.length;
    this.clipboardProxiesWithAuthCount = lines.filter(line => (line.match(/:/g) || []).length === 3).length;
    this.uniqueClipboardProxiesCount = Array.from(new Set(proxies)).length;
  }

  triggerFileInput(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  openDialog(): void {
    this.dialogVisible = true;
  }

  closeDialog(): void {
    this.dialogVisible = false;
    this.resetFormState();
  }

  onDialogHide(): void {
    this.resetFormState();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.file = input.files[0];

      const reader = new FileReader();
      reader.onload = (_: ProgressEvent<FileReader>) => {
        const content = reader.result as string;
        const lines = content.split(/\r?\n/);
        let proxies = lines.filter(line => (line.match(/:/g) || []).length === 1)

        this.fileProxiesNoAuthCount = proxies.length;
        this.fileProxiesWithAuthCount = lines.filter(line => (line.match(/:/g) || []).length === 3).length;
        this.uniqueFileProxiesCount = Array.from(new Set(proxies)).length;
      };

      reader.readAsText(this.file);
    }
  }

  onFileClear(): void {
    this.file = undefined;
    this.fileProxiesWithAuthCount = 0;
    this.fileProxiesNoAuthCount = 0;
    this.uniqueFileProxiesCount = 0;
  }

  addTextAreaProxies() {
    const lines = this.ProxyTextarea.split(/\r?\n/);
    let proxies = lines.filter(line => (line.match(/:/g) || []).length === 1)

    this.textAreaProxiesNoAuthCount = proxies.length;
    this.textAreaProxiesWithAuthCount = lines.filter(line => (line.match(/:/g) || []).length === 3).length;
    this.uniqueTextAreaProxiesCount = Array.from(new Set(proxies)).length;
  }

  getProxiesWithoutAuthCount() {
    return this.textAreaProxiesNoAuthCount + this.fileProxiesNoAuthCount + this.clipboardProxiesNoAuthCount;
  }

  getProxiesWithAuthCount() {
    return this.textAreaProxiesWithAuthCount + this.fileProxiesWithAuthCount + this.clipboardProxiesWithAuthCount;
  }

  getUniqueProxiesCount() {
    return this.uniqueFileProxiesCount + this.uniqueTextAreaProxiesCount + this.uniqueClipboardProxiesCount;
  }

  submitProxies() {
    if (this.file || this.ProxyTextarea || this.clipboardProxies) {
      this.showPopup = true;
      this.popupStatus = 'processing';

      const formData = new FormData();

      if (this.file) {
        formData.append('file', this.file);
      } else {
        formData.append('file', '');
      }

      if (this.ProxyTextarea) {
        formData.append('proxyTextarea', this.ProxyTextarea);
      }

      if (this.clipboardProxies) {
        formData.append('clipboardProxies', this.clipboardProxies);
      }

      this.service.uploadProxies(formData).subscribe({
        next: (response) => {
          this.addedProxyCount = response.proxyCount;
          this.popupStatus = 'success';
          this.dialogVisible = false;

          this.file = undefined;
          this.ProxyTextarea = "";
          this.clipboardProxies = "";
          this.onFileClear();
          this.clearClipboardProxies();
          this.addTextAreaProxies();
          this.showAddProxiesMessage.emit(false);
          this.proxiesAdded.emit();
        },
        error: (err) => {
          this.popupStatus = 'error';
          NotificationService.showError("Could not upload proxies: " + err.error.message)
        },
      });
    } else {
      console.warn('No data to submit');
    }
  }

  onPopupClose() {
    this.showPopup = false;
  }

  private resetFormState(): void {
    this.ProxyTextarea = "";
    this.clipboardProxies = "";
    this.file = undefined;
    this.onFileClear();
    this.clearClipboardProxies();
    this.addTextAreaProxies();
  }
}
