import { Component } from '@angular/core';
import { MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { MatInput } from '@angular/material/input';
import { NgForOf, NgIf } from '@angular/common';
import { CheckboxComponent } from '../../../checkbox/checkbox.component';
import { MatDivider } from '@angular/material/divider';
import {MatOption} from '@angular/material/core';
import {MatSelect} from '@angular/material/select';
import {SettingsService} from '../../../services/settings.service';

@Component({
  selector: 'app-export-proxies-dialog',
  templateUrl: './export-proxies-dialog.component.html',
  styleUrls: ['./export-proxies-dialog.component.scss'],
  imports: [
    MatDialogActions,
    MatButton,
    MatFormField,
    FormsModule,
    MatRadioButton,
    MatRadioGroup,
    MatDialogContent,
    MatDialogTitle,
    MatInput,
    NgIf,
    NgForOf,
    MatLabel,
    ReactiveFormsModule,
    CheckboxComponent,
    MatDivider,
    MatOption,
    MatSelect
  ],
  standalone: true
})
export class ExportProxiesDialogComponent {
  exportOption: string = 'all';

  predefinedFilters: string[] = ['protocol', 'ip', 'port', 'username', 'password', 'country', 'alive', 'type', 'time'];

  exportForm: FormGroup;

  constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<ExportProxiesDialogComponent>, private settingsService: SettingsService) {
    let settings = settingsService.getUserSettings()
    this.exportForm = this.fb.group({
      output: ['protocol://ip:port;username;password', [Validators.required]],
      filter: [false],
      HTTPProtocol: [settings?.http_protocol],
      HTTPSProtocol: [settings?.https_protocol],
      SOCKS4Protocol: [settings?.socks4_protocol],
      SOCKS5Protocol: [settings?.socks5_protocol],
      Retries: [settings?.retries, [Validators.required]],
      Timeout: [settings?.timeout, [Validators.required]],
      proxyStatus: ['all']
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onExport(): void {
    // Pass the export option and the additional proxyStatus criteria along with the other form values.
    this.dialogRef.close({
      option: this.exportOption,
      criteria: this.exportForm.value.output,
      proxyStatus: this.exportForm.value.proxyStatus
    });
  }

  addToFilter(text: string): void {
    const currentValue = this.exportForm.get('output')?.value;
    const newValue = currentValue ? `${currentValue};${text}` : text;
    this.exportForm.get('output')?.setValue(newValue);
  }
}
