import {Component, EventEmitter, Output} from '@angular/core';
import {CheckboxComponent} from "../../../checkbox/checkbox.component";
import {MatIcon} from "@angular/material/icon";
import {MatTooltip} from "@angular/material/tooltip";
import {ProcesingPopupComponent} from "../../../proxies/add-proxies/procesing-popup/procesing-popup.component";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {TooltipComponent} from "../../../tooltip/tooltip.component";
import {HttpService} from '../../../services/http.service';

@Component({
  selector: 'app-add-scrape-source',
  standalone: true,
  imports: [
    CheckboxComponent,
    MatIcon,
    MatTooltip,
    ProcesingPopupComponent,
    ReactiveFormsModule,
    TooltipComponent,
    FormsModule
  ],
  templateUrl: './add-scrape-source.component.html',
  styleUrl: './add-scrape-source.component.scss'
})
export class AddScrapeSourceComponent {
  @Output() showAddScrapeSourcesMessage = new EventEmitter<boolean>();

  file: File | undefined;
  scrapeSourceTextarea: string = "";
  clipboardScrapeSources: string = "";

  fileSourcesNoAuthCount: number = 0;
  fileSourcesWithAuthCount: number = 0;
  uniqueFileSourcesCount: number = 0;

  textAreaSourcesNoAuthCount: number = 0;
  textAreaSourcesWithAuthCount: number = 0;
  uniqueTextAreaSourcesCount: number = 0;

  clipboardSourcesNoAuthCount: number = 0;
  clipboardSourcesWithAuthCount: number = 0;
  uniqueClipboardSourcesCount: number = 0;

  showPopup = false;
  popupStatus: 'processing' | 'success' | 'error' = 'processing';
  addedSourceCount = 0;

  constructor(private service: HttpService) { }

  async pasteFromClipboard(): Promise<void> {
    try {
      this.clipboardScrapeSources = await navigator.clipboard.readText();
      this.processClipboardSources();
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  }

  clearClipboardSources(): void {
    this.clipboardScrapeSources = "";
    this.clipboardSourcesNoAuthCount = 0;
    this.clipboardSourcesWithAuthCount = 0;
    this.uniqueClipboardSourcesCount = 0;
  }

  processClipboardSources() {
    if (!this.clipboardScrapeSources) {
      this.clearClipboardSources();
      return;
    }

    const lines = this.clipboardScrapeSources.split(/\r?\n/);
    const sources = lines.filter(line => (line.match(/:/g) || []).length === 1);

    this.clipboardSourcesNoAuthCount = sources.length;
    this.clipboardSourcesWithAuthCount = lines.filter(line => (line.match(/:/g) || []).length === 3).length;
    this.uniqueClipboardSourcesCount = Array.from(new Set(sources)).length;
  }

  triggerFileInput(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.file = input.files[0];

      const reader = new FileReader();
      reader.onload = (_: ProgressEvent<FileReader>) => {
        const content = reader.result as string;
        const lines = content.split(/\r?\n/);
        let sources = lines.filter(line => (line.match(/:/g) || []).length === 1)

        this.fileSourcesNoAuthCount = sources.length;
        this.fileSourcesWithAuthCount = lines.filter(line => (line.match(/:/g) || []).length === 3).length;
        this.uniqueFileSourcesCount = Array.from(new Set(sources)).length;
      };

      reader.readAsText(this.file);
    }
  }

  onFileClear(): void {
    this.file = undefined;
    this.fileSourcesWithAuthCount = 0;
    this.fileSourcesNoAuthCount = 0;
    this.uniqueFileSourcesCount = 0;
  }

  addTextAreaSources() {
    const lines = this.scrapeSourceTextarea.split(/\r?\n/);
    let sources = lines.filter(line => (line.match(/:/g) || []).length === 1)

    this.textAreaSourcesNoAuthCount = sources.length;
    this.textAreaSourcesWithAuthCount = lines.filter(line => (line.match(/:/g) || []).length === 3).length;
    this.uniqueTextAreaSourcesCount = Array.from(new Set(sources)).length;
  }

  getSourcesWithoutAuthCount() {
    return this.textAreaSourcesNoAuthCount + this.fileSourcesNoAuthCount + this.clipboardSourcesNoAuthCount;
  }

  getSourcesWithAuthCount() {
    return this.textAreaSourcesWithAuthCount + this.fileSourcesWithAuthCount + this.clipboardSourcesWithAuthCount;
  }

  getUniqueSourcesCount() {
    return this.uniqueFileSourcesCount + this.uniqueTextAreaSourcesCount + this.uniqueClipboardSourcesCount;
  }

  submitScrapeSources() {
    if (this.file || this.scrapeSourceTextarea || this.clipboardScrapeSources) {
      this.showPopup = true;
      this.popupStatus = 'processing';

      const formData = new FormData();

      if (this.file) {
        formData.append('file', this.file);
      } else {
        formData.append('file', '');
      }

      if (this.scrapeSourceTextarea) {
        formData.append('scrapeSourceTextarea', this.scrapeSourceTextarea);
      }

      if (this.clipboardScrapeSources) {
        formData.append('clipboardScrapeSources', this.clipboardScrapeSources);
      }

      this.service.uploadScrapeSources(formData).subscribe({
        next: (response) => {
          this.addedSourceCount = response.sourceCount;
          this.popupStatus = 'success';

          this.file = undefined;
          this.scrapeSourceTextarea = "";
          this.clipboardScrapeSources = "";
          this.onFileClear();
          this.clearClipboardSources();
          this.addTextAreaSources();
          this.showAddScrapeSourcesMessage.emit(false);
        },
        error: () => {
          this.popupStatus = 'error';
        },
      });
    } else {
      console.warn('No data to submit');
    }
  }

  onPopupClose() {
    this.showPopup = false;
  }
}
