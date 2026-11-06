import {loadProxyFilterOptions} from '../../../shared/proxy-filter-options';

import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {CheckboxComponent} from '../../../checkbox/checkbox.component';
import {SettingsService} from '../../../services/settings.service';
import {HttpService} from '../../../services/http.service';
import {ProxyInfo} from '../../../models/ProxyInfo';
import {NotificationService} from '../../../services/notification-service.service';
import {DeleteSettings} from '../../../models/DeleteSettings';
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
import {BulkScopeSelectorComponent} from '../../../shared/bulk-scope-selector/bulk-scope-selector.component';
import {ProxyTag} from '../../../models/ProxyTag';
import {BulkActionDialogComponent} from '../../../shared/bulk-action-dialog/bulk-action-dialog.component';

type DeleteFormDefaults = {
  filter: boolean;
} & ProxyListFilterFormValues;

@Component({
  selector: 'app-delete-proxies',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CheckboxComponent,
    ProxyFilterPanelComponent,
    BulkScopeSelectorComponent,
    BulkActionDialogComponent,
  ],
  templateUrl: './delete-proxies.component.html',
})
export class DeleteProxiesComponent implements OnChanges {
  @Input() selectedProxies: ProxyInfo[] = [];
  @Input() allProxies: ProxyInfo[] = [];
  @Output() proxiesDeleted = new EventEmitter<void>();

  dialogVisible = false;
  isDeleting = false;
  deleteOption: 'all' | 'selected' = 'all';
  deleteForm: FormGroup;

  readonly proxyStatusOptions = PROXY_STATUS_OPTIONS;
  readonly proxyReputationOptions = PROXY_REPUTATION_OPTIONS;
  countryOptions: ProxyFilterOption[] = [];
  typeOptions: ProxyFilterOption[] = [];
  anonymityOptions: ProxyFilterOption[] = [];
  tagOptions: ProxyTag[] = [];

  private defaultFormValues: DeleteFormDefaults;
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
      filter: false,
      http: settings?.http_protocol ?? false,
      https: settings?.https_protocol ?? false,
      socks4: settings?.socks4_protocol ?? false,
      socks5: settings?.socks5_protocol ?? false,
      maxRetries: settings?.retries ?? 0,
      maxTimeout: settings?.timeout ?? 0,
    };

    this.deleteForm = this.fb.group({
      filter: [this.defaultFormValues.filter],
      ...createProxyFilterControls(this.defaultFormValues),
    });
  }

  clearDeleteFilters(): void {
    this.deleteForm.patchValue({
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
    if (changes['selectedProxies'] && this.deleteOption === 'selected' && !this.canDeleteSelected()) {
      this.deleteOption = 'all';
    }
  }

  openDialog(): void {
    if (!this.hasAnyProxies()) {
      this.notification.showError('No proxies available to delete.');
      return;
    }

    this.syncDefaultsWithUserSettings();
    this.ensureFilterOptionsLoaded();
    this.deleteOption = this.canDeleteSelected() ? 'selected' : 'all';
    this.dialogVisible = true;
  }

  closeDialog(): void {
    this.dialogVisible = false;
  }

  onDialogHide(): void {
    this.resetFormState();
  }

  hasAnyProxies(): boolean {
    return (this.allProxies?.length ?? 0) > 0 || (this.selectedProxies?.length ?? 0) > 0;
  }

  canDeleteSelected(): boolean {
    return (this.selectedProxies?.length ?? 0) > 0;
  }

  submitDelete(): void {
    if (this.deleteOption === 'selected' && !this.canDeleteSelected()) {
      this.notification.showError('No proxies selected for deletion.');
      return;
    }

    const deleteSettings = this.transformFormToDelete(this.deleteForm, this.deleteOption);
    if (deleteSettings.scope === 'selected' && deleteSettings.proxies.length === 0) {
      this.notification.showError('No proxies selected for deletion.');
      return;
    }

    this.isDeleting = true;

    this.http.deleteProxies(deleteSettings).subscribe({
      next: res => {
        const message = res;
        const normalized = message.trim().toLowerCase();

        if (normalized.includes('no proxies')) {
          this.notification.showInfo(message);
        } else {
          this.notification.showSuccess(message);
        }

        this.isDeleting = false;
        this.closeDialog();
        this.proxiesDeleted.emit();
      },
      error: err => {
        this.isDeleting = false;
        const message = err?.error?.message ?? err?.message ?? 'Unknown error';
        this.notification.showError('Could not delete proxies: ' + message);
      }
    });
  }

  private resetFormState(): void {
    this.deleteForm.reset(this.defaultFormValues);
    this.deleteOption = 'all';
    this.isDeleting = false;
  }

  private syncDefaultsWithUserSettings(): void {
    const settings = this.settingsService.getUserSettings();
    if (!settings) {
      return;
    }

    const updatedDefaults: Partial<DeleteFormDefaults> = {
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

    this.deleteForm.patchValue(updatedDefaults, {emitEvent: false});
  }

  private transformFormToDelete(form: FormGroup, scope: 'all' | 'selected'): DeleteSettings {
    const formValue = form.getRawValue();
    const proxies = scope === 'selected' ? this.selectedProxies : [];
    const filtersEnabled = Boolean(formValue.filter);

    return {
      proxies: proxies.map(proxy => proxy.id),
      ...buildBulkProxyFilters(formValue, filtersEnabled),
      scope,
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
}
