import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog'; // Corrected import
import { ButtonModule } from 'primeng/button';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { DividerModule } from 'primeng/divider';
import { FieldsetModule } from 'primeng/fieldset'; // For the fieldset around radio buttons

import { CheckboxComponent } from '../../../checkbox/checkbox.component'; // Assuming this is your custom checkbox
import { SettingsService } from '../../../services/settings.service';
import { HttpService } from '../../../services/http.service';
import { ProxyInfo } from '../../../models/ProxyInfo';
import { ExportSettings } from '../../../models/ExportSettings';
import { SnackbarService } from '../../../services/snackbar.service';
import { CommonModule, DatePipe } from '@angular/common';
import {Select} from 'primeng/select'; // Import CommonModule for ngIf, ngFor, etc.

@Component({
  selector: 'app-export-proxies-dialog',
  standalone: true, // Mark as standalone
  templateUrl: './export-proxies-dialog.component.html',
  styleUrls: ['./export-proxies-dialog.component.scss'], // Tailwind classes are mostly in HTML
  imports: [
    CommonModule, // Required for @if, @for, etc.
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    RadioButtonModule,
    InputNumberModule,
    InputTextModule,
    DividerModule,
    FieldsetModule, // Add FieldsetModule
    CheckboxComponent, // Your custom checkbox component
    DatePipe,
    Select,
    // If you use DatePipe in the template for any reason, keep it.
  ]
})
export class ExportProxiesDialogComponent implements OnInit {
  exportOption: string = 'all';
  predefinedFilters: string[] = ['protocol', 'ip', 'port', 'username', 'password', 'country', 'alive', 'type', 'time'];
  exportForm: FormGroup;
  selectedProxies: ProxyInfo[];

  proxyStatusOptions = [
    { label: 'All Proxies', value: 'all' },
    { label: 'Only Alive Proxies', value: 'alive' },
    { label: 'Only Dead Proxies', value: 'dead' }
  ];

  constructor(
    private fb: FormBuilder,
    public ref: DynamicDialogRef, // Use DynamicDialogRef for PrimeNG
    public config: DynamicDialogConfig, // Use DynamicDialogConfig for PrimeNG to get data
    private settingsService: SettingsService,
    private http: HttpService
  ) {
    this.selectedProxies = this.config.data.selectedProxies || [];

    const settings = settingsService.getUserSettings();
    this.exportForm = this.fb.group({
      output: ['protocol://ip:port', [Validators.required]],
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

  ngOnInit(): void {
    // You can add any initialization logic here if needed
  }

  onCancel(): void {
    this.ref.close();
  }

  onExport(): void {
    let proxiesToExport: ProxyInfo[] = [];

    if (this.exportOption === 'selected') {
      proxiesToExport = this.selectedProxies;
    } else {
      // If 'all' is selected, you might need to fetch all proxies from your service
      // or if `dataSource.data` from the parent component is passed, use that.
      // For now, assuming you'll handle fetching all proxies if needed.
      // If `this.config.data.allProxies` was passed, you could use that.
      // For this example, I'll assume the parent component will handle passing `all` proxies if `exportOption` is 'all'
      // or you'll fetch them here.
      // For simplicity, let's assume `this.config.data.allProxies` is available if 'all' is chosen
      // Or, you might need to emit an event to the parent to get all proxies if not passed.
      // For now, I'll make a placeholder for 'all' based on the parent's `dataSource.data` if it was passed.
      if (this.config.data.allProxies) { // Assuming parent passes allProxies if available
        proxiesToExport = this.config.data.allProxies;
      } else {
        // Fallback or explicit fetch if 'all' proxies are not passed
        // This might involve calling http.getAllProxies()
        // For now, if 'all' is selected and no `allProxies` is passed, it will export based on the current `selectedProxies` (which might be empty)
        // You'll need to adjust this logic based on how you intend to get 'all' proxies.
        console.warn("Exporting 'all' proxies, but no `allProxies` data was provided to the dialog. Ensure `allProxies` is passed via DynamicDialogConfig if needed, or implement fetching logic here.");
        // As a temporary measure, if 'all' is selected and no `allProxies` is provided, we might just use the currently loaded ones
        // or prompt the user. For now, we'll proceed with whatever `proxiesToExport` holds.
      }
    }


    const exportSettings = this.transformFormToExport(this.exportForm, proxiesToExport);

    const today = new Date();
    const formattedDate = this.formatDate(today);
    const randomCode = this.generateRandomCode(4);
    const fileName = `${formattedDate}-${randomCode}-magpie.txt`;

    this.http.exportProxies(exportSettings).subscribe({
      next: res => {
        const blob = new Blob([res], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        window.URL.revokeObjectURL(url);

        this.ref.close({
          option: this.exportOption,
          criteria: this.exportForm.value.output, // This might need to be adjusted based on actual filter criteria
          proxyStatus: this.exportForm.value.proxyStatus,
          filterSettings: this.exportForm.value.filter ? this.exportForm.value : null // Pass full filter settings if filter is active
        });
      },
      error: err => SnackbarService.openSnackbarDefault('Error while exporting proxies: ' + err.error.message)
    });
  }

  addToFilter(text: string): void {
    const currentValue = this.exportForm.get('output')?.value;
    const newValue = currentValue && currentValue !== '' ? `${currentValue};${text}` : text;
    this.exportForm.get('output')?.setValue(newValue);
  }

  transformFormToExport(exportForm: FormGroup, proxies: ProxyInfo[]): ExportSettings {
    const formValue = exportForm.value;

    return {
      proxies: proxies.map(proxy => proxy.id),
      filter: formValue.filter,
      http: formValue.HTTPProtocol,
      https: formValue.HTTPSProtocol,
      socks4: formValue.SOCKS4Protocol,
      socks5: formValue.SOCKS5Protocol,
      maxRetries: formValue.Retries,
      maxTimeout: formValue.Timeout,
      proxyStatus: formValue.proxyStatus,
      outputFormat: formValue.output
    };
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  generateRandomCode(length: number = 4): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }
}
