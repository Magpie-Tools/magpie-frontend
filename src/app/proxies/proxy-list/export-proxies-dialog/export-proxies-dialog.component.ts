import { Component } from '@angular/core';
import {MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {MatButton} from '@angular/material/button';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatRadioButton, MatRadioGroup} from '@angular/material/radio';
import {MatInput} from '@angular/material/input';
import {NgForOf, NgIf} from '@angular/common';
import {CheckboxComponent} from '../../../checkbox/checkbox.component';
import {MatDivider} from '@angular/material/divider';

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
    MatDivider
  ],
  standalone: true
})
export class ExportProxiesDialogComponent {
  exportOption: string = 'all';

  predefinedFilters: string[] = ['protocol', 'ip', 'port', 'username', 'password', 'country', 'alive', 'type', 'time'];

  exportForm: FormGroup;

  constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<ExportProxiesDialogComponent>) {
    this.exportForm = this.fb.group({
      output: ['protocol://ip:port;username;password', [Validators.required]],
      filter: [false, []]
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onExport(): void {
    this.dialogRef.close({ option: this.exportOption, criteria: this.exportForm.value.output });
  }

  addToFilter(text: string): void {
    const currentValue = this.exportForm.get('output')?.value;
    const newValue = currentValue ? `${currentValue};${text}` : text;
    this.exportForm.get('output')?.setValue(newValue);
  }
}
