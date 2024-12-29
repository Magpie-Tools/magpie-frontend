import { Component } from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {ReactiveFormsModule} from '@angular/forms';
import {CheckboxComponent} from '../checkbox/checkbox.component';
import {MatTooltip} from '@angular/material/tooltip';

@Component({
  selector: 'app-proxies',
  standalone: true,
  imports: [
    MatIcon,
    ReactiveFormsModule,
    CheckboxComponent,
    MatTooltip
  ],
  templateUrl: './proxies.component.html',
  styleUrl: './proxies.component.scss'
})
export class ProxiesComponent {
  triggerFileInput(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      console.log(file); // Do something with the selected file
    }
  }

}
