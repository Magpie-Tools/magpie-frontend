import { Component } from '@angular/core';
import {CheckboxComponent} from "../../checkbox/checkbox.component";
import {FormsModule} from "@angular/forms";
import {MatIcon} from "@angular/material/icon";
import {MatTooltip} from "@angular/material/tooltip";
import {TooltipComponent} from "../../tooltip/tooltip.component";
import {HttpService} from '../../services/http.service';

@Component({
  selector: 'app-add-proxies',
  standalone: true,
    imports: [
        CheckboxComponent,
        FormsModule,
        MatIcon,
        MatTooltip,
        TooltipComponent
    ],
  templateUrl: './add-proxies.component.html',
  styleUrl: './add-proxies.component.scss'
})
export class AddProxiesComponent {
  constructor(private service: HttpService) { }

  file: File | undefined
  ProxyTextarea: string = ""
  fileProxiesNoAuthCount: number = 0;
  fileProxiesWithAuthCount: number = 0;
  uniqueFileProxiesCount: number = 0;

  textAreaProxiesNoAuthCount: number = 0;
  textAreaProxiesWithAuthCount: number = 0;
  uniqueTextAreaProxiesCount: number = 0;

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
    return this.textAreaProxiesNoAuthCount+this.fileProxiesNoAuthCount;
  }

  getProxiesWithAuthCount() {
    return this.textAreaProxiesWithAuthCount+this.fileProxiesWithAuthCount;
  }

  getUniqueProxiesCount() {
    return this.uniqueFileProxiesCount + this.uniqueTextAreaProxiesCount;
  }

  submitProxies() {
    if (this.file || this.ProxyTextarea) {
      const formData = new FormData();

      if (this.file) {
        formData.append('file', this.file);
      } else {
        formData.append('file', '');
      }

      if (this.ProxyTextarea) {
        formData.append('proxyTextarea', this.ProxyTextarea);
      }

      this.service.uploadProxies(formData).subscribe({
        next: (response) => {
          this.file = undefined;
          this.ProxyTextarea = ""
          this.onFileClear()
          this.addTextAreaProxies()
          console.log('Upload successful', response);
        },
        error: (error) => {
          console.error('Upload failed', error);
        },
      });
    } else {
      console.warn('No data to submit');
    }
  }
}
