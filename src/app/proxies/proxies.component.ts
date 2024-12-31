import { Component } from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {ReactiveFormsModule} from '@angular/forms';
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
    TooltipComponent
  ],
  templateUrl: './proxies.component.html',
  styleUrl: './proxies.component.scss'
})
export class ProxiesComponent {

  constructor(private service: HttpService) { }

  triggerFileInput(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.service.uploadProxyFile(input.files[0]).subscribe({
        next: (response) => {
          console.log('Upload successful', response);
        },
        error: (error) => {
          console.error('Upload failed', error);
        }
      });
    }
  }

}
