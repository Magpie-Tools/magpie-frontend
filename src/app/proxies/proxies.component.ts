import { Component } from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {CheckboxComponent} from '../checkbox/checkbox.component';
import {MatTooltip} from '@angular/material/tooltip';
import {TooltipComponent} from '../tooltip/tooltip.component';
import {HttpService} from '../services/http.service';

@Component({
  selector: 'app-proxies',
  standalone: true,
  imports: [
    MatIcon,
    ReactiveFormsModule,
    CheckboxComponent,
    MatTooltip,
    TooltipComponent,
    FormsModule
  ],
  templateUrl: './proxies.component.html',
  styleUrl: './proxies.component.scss'
})
export class ProxiesComponent {

  constructor(private service: HttpService) { }

  file: File | undefined
  ProxyTextarea: string = ""
  fileProxiesNoAuthCount: number = 0;
  fileProxiesWithAuthCount: number = 0;

  textAreaProxiesNoAuthCount: number = 0;
  textAreaProxiesWithAuthCount: number = 0;

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
        this.fileProxiesNoAuthCount = lines.filter(line => (line.match(/:/g) || []).length === 1).length;

        this.fileProxiesWithAuthCount = lines.filter(line => (line.match(/:/g) || []).length === 3).length;
      };

      reader.readAsText(this.file);
    }
  }

  onFileClear(): void {
    this.file = undefined;
    this.fileProxiesWithAuthCount = 0;
    this.fileProxiesNoAuthCount = 0;
  }

  addTextAreaProxies() {
    const lines = this.ProxyTextarea.split(/\r?\n/);
    this.textAreaProxiesNoAuthCount = lines.filter(line => (line.match(/:/g) || []).length === 1).length;

    this.textAreaProxiesWithAuthCount = lines.filter(line => (line.match(/:/g) || []).length === 3).length;
  }

  getProxiesWithoutAuthCount() {
    return this.textAreaProxiesNoAuthCount+this.fileProxiesNoAuthCount;
  }

  getProxiesWithAuthCount() {
    return this.textAreaProxiesWithAuthCount+this.fileProxiesWithAuthCount;
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
