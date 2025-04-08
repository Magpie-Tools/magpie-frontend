import {Component, Inject} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';
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
import {HttpService} from '../../../services/http.service';
import {ProxyInfo} from '../../../models/ProxyInfo';
import {ProxyListComponent} from '../proxy-list.component';
import {ExportSettings} from '../../../models/ExportSettings';

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
  selectedProxies: ProxyInfo[]


  constructor(private fb: FormBuilder,
              public dialogRef: MatDialogRef<ExportProxiesDialogComponent>,
              private settingsService: SettingsService,
              private http: HttpService,
              @Inject(MAT_DIALOG_DATA) public data: { selectedProxies: ProxyInfo[] },
  ) {
    this.selectedProxies = data.selectedProxies

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
    let proxies: ProxyInfo[] = []

    if (this.exportOption == 'selected') {
      proxies = this.selectedProxies
    }


    let exportSettings = this.transformFormToExport(this.exportForm, proxies)

    this.http.exportProxies(exportSettings).subscribe(res => {
      console.log(res)
    })

    // this.dialogRef.close({
    //   option: this.exportOption,
    //   criteria: this.exportForm.value.output,
    //   proxyStatus: this.exportForm.value.proxyStatus
    // });
  }

  addToFilter(text: string): void {
    const currentValue = this.exportForm.get('output')?.value;
    const newValue = currentValue ? `${currentValue};${text}` : text;
    this.exportForm.get('output')?.setValue(newValue);
  }

  transformFormToExport(exportForm: FormGroup, selectedProxies: ProxyInfo[]): ExportSettings {
    const formValue = exportForm.value;

    return {
      proxies: selectedProxies.map(proxy => proxy.id),
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
}
