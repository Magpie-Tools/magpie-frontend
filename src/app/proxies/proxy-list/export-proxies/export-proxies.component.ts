import {loadProxyFilterOptions} from '../../../shared/proxy-filter-options';

import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {CheckboxComponent} from '../../../checkbox/checkbox.component';
import {SettingsService} from '../../../services/settings.service';
import {HttpService} from '../../../services/http.service';
import {ProxyInfo} from '../../../models/ProxyInfo';
import {ExportSettings} from '../../../models/ExportSettings';
import {NotificationService} from '../../../services/notification-service.service';
import {ProxyFilterPanelComponent} from '../../../shared/proxy-filter-panel/proxy-filter-panel.component';
import {
  PROXY_REPUTATION_OPTIONS,
  PROXY_STATUS_OPTIONS,
  ProxyFilterOption,
  ProxyListFilterFormValues,
  createDefaultProxyFilterValues,
  createProxyFilterControls,
  buildBulkProxyFilters,
} from '../../../shared/proxy-filters';
import {ProxyTag} from '../../../models/ProxyTag';
import {BulkScopeSelectorComponent} from '../../../shared/bulk-scope-selector/bulk-scope-selector.component';
import {buildDatedExportFileName, downloadTextFile, extractHttpErrorMessage} from '../../../shared/export-file-utils';
import {BulkActionDialogComponent} from '../../../shared/bulk-action-dialog/bulk-action-dialog.component';
import {ExportFormatBuilderComponent} from '../../../shared/export-format-builder/export-format-builder.component';

type ExportFormDefaults = {
  output: string;
  filter: boolean;
} & ProxyListFilterFormValues;

@Component({
  selector: 'app-export-proxies',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CheckboxComponent,
    ProxyFilterPanelComponent,
    BulkScopeSelectorComponent,
    BulkActionDialogComponent,
    ExportFormatBuilderComponent,
  ],
  templateUrl: './export-proxies.component.html',
})
export class ExportProxiesComponent implements OnChanges {
  @Input() selectedProxies: ProxyInfo[] = [];
  @Input() allProxies: ProxyInfo[] = [];
  dialogVisible = false;
  isExporting = false;
  exportOption: 'all' | 'selected' = 'all';
  exportForm: FormGroup;

  readonly predefinedFilters: string[] = ['protocol', 'ip', 'port', 'username', 'password', 'country', 'alive', 'type', 'time', 'reputation_label', 'reputation_score'];
  readonly proxyStatusOptions = PROXY_STATUS_OPTIONS;
  readonly proxyReputationOptions = PROXY_REPUTATION_OPTIONS;
  countryOptions: ProxyFilterOption[] = [];
  typeOptions: ProxyFilterOption[] = [];
  anonymityOptions: ProxyFilterOption[] = [];
  tagOptions: ProxyTag[] = [];

  private defaultFormValues: ExportFormDefaults;
  private filterOptionsLoaded = false;

  constructor(
    private fb: FormBuilder,
    private settingsService: SettingsService,
    private http: HttpService,
    private notification: NotificationService
  ) {
    const settings = this.settingsService.getUserSettings();

    const defaultFilterValues = createDefaultProxyFilterValues();

    this.defaultFormValues = {
      ...defaultFilterValues,
      output: 'protocol://ip:port',
      filter: false,
      http: settings?.http_protocol ?? false,
      https: settings?.https_protocol ?? false,
      socks4: settings?.socks4_protocol ?? false,
      socks5: settings?.socks5_protocol ?? false,
      maxRetries: settings?.retries ?? 0,
      maxTimeout: settings?.timeout ?? 0,
    };

    this.exportForm = this.fb.group({
      output: [this.defaultFormValues.output, Validators.required],
      filter: [this.defaultFormValues.filter],
      ...createProxyFilterControls(this.defaultFormValues),
      maxTimeout: [this.defaultFormValues.maxTimeout, Validators.required],
      maxRetries: [this.defaultFormValues.maxRetries, Validators.required],
    });
  }

  clearExportFilters(): void {
    this.exportForm.patchValue({
      proxyStatus: this.defaultFormValues.proxyStatus,
      http: false,
      https: false,
      socks4: false,
      socks5: false,
      minHealthOverall: 0,
      minHealthHttp: 0,
      minHealthHttps: 0,
      minHealthSocks4: 0,
      minHealthSocks5: 0,
      maxTimeout: 0,
      maxRetries: 0,
      countries: [],
      types: [],
      anonymityLevels: [],
      reputationLabels: [],
      tagIds: [],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedProxies'] && this.exportOption === 'selected' && !this.canExportSelected()) {
      this.exportOption = 'all';
    }
  }

  openDialog(): void {
    if (!this.hasAnyProxies()) {
      this.notification.showError('No proxies available to export.');
      return;
    }
    this.syncDefaultsWithUserSettings();
    this.ensureFilterOptionsLoaded();
    this.exportOption = this.canExportSelected() ? 'selected' : 'all';
    this.dialogVisible = true;
  }

  closeDialog(): void {
    this.dialogVisible = false;
  }

  onDialogHide(): void {
    this.resetFormState();
  }

  hasAnyProxies(): boolean {
    return (this.allProxies?.length ?? 0) > 0;
  }

  canExportSelected(): boolean {
    return (this.selectedProxies?.length ?? 0) > 0;
  }

  submitExport(): void {
    const proxies = this.exportOption === 'selected' ? this.selectedProxies : this.allProxies;
    if (!proxies || proxies.length === 0) {
      this.notification.showError('No proxies selected for export.');
      return;
    }

    this.isExporting = true;

    const exportSettings = this.transformFormToExport(this.exportForm, proxies, this.exportOption);
    const fileName = this.buildFileName();

    this.http.exportProxies(exportSettings).subscribe({
      next: res => {
        downloadTextFile(res, fileName);
        this.isExporting = false;
        this.closeDialog();
      },
      error: err => {
        this.isExporting = false;
        const message = extractHttpErrorMessage(err);
        this.notification.showError('Error while exporting proxies: ' + message);
      }
    });
  }

  private resetFormState(): void {
    this.exportForm.reset(this.defaultFormValues);
    this.exportOption = 'all';
    this.isExporting = false;
  }

  private syncDefaultsWithUserSettings(): void {
    const settings = this.settingsService.getUserSettings();
    if (!settings) {
      return;
    }

    const updatedDefaults: Partial<ExportFormDefaults> = {
      http: settings.http_protocol,
      https: settings.https_protocol,
      socks4: settings.socks4_protocol,
      socks5: settings.socks5_protocol,
      maxRetries: settings.retries,
      maxTimeout: settings.timeout,
    };

    this.defaultFormValues = {
      ...this.defaultFormValues,
      ...updatedDefaults,
    };

    this.exportForm.patchValue(updatedDefaults, {emitEvent: false});
  }

  private transformFormToExport(exportForm: FormGroup, proxies: ProxyInfo[], scope: 'all' | 'selected'): ExportSettings {
    const formValue = exportForm.getRawValue();
    const proxyIds = scope === 'selected' ? proxies.map(proxy => proxy.id) : [];
    const filtersEnabled = Boolean(formValue.filter);

    return {
      proxies: proxyIds,
      ...buildBulkProxyFilters(formValue, filtersEnabled),
      outputFormat: formValue.output
    };
  }

  private ensureFilterOptionsLoaded(): void {
    if (this.filterOptionsLoaded) {
      return;
    }
    loadProxyFilterOptions(this.http, this.notification).subscribe(options => {
      this.countryOptions = options.countries;
      this.typeOptions = options.types;
      this.anonymityOptions = options.anonymityLevels;
      this.tagOptions = options.filters.tags ?? [];
      this.filterOptionsLoaded = true;
    });
  }

  private buildFileName(): string {
    return buildDatedExportFileName('magpie.txt');
  }
}
