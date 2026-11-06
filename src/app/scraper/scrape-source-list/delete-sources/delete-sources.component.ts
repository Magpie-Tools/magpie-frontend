import {Component, EventEmitter, inject, Input, LOCALE_ID, OnChanges, Output, SimpleChanges} from '@angular/core';
import {formatNumber} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {CheckboxComponent} from '../../../checkbox/checkbox.component';
import {HttpService} from '../../../services/http.service';
import {NotificationService} from '../../../services/notification-service.service';
import {ScrapeSourceInfo} from '../../../models/ScrapeSourceInfo';
import {ScrapeSourceDeleteSettings} from '../../../models/ScrapeSourceDeleteSettings';
import {ScrapeSourceFilterPanelComponent} from '../scrape-source-filter-panel/scrape-source-filter-panel.component';
import {BulkScopeSelectorComponent} from '../../../shared/bulk-scope-selector/bulk-scope-selector.component';
import {normalizeNumber} from '../../../shared/number-utils';
import {BulkActionDialogComponent} from '../../../shared/bulk-action-dialog/bulk-action-dialog.component';

type DeleteSourcesFormDefaults = {
  filter: boolean;
  http: boolean;
  https: boolean;
  proxyCountOperator: '<' | '>';
  proxyCount: number;
  aliveCountOperator: '<' | '>';
  aliveCount: number;
};

@Component({
  selector: 'app-delete-sources',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CheckboxComponent,
    ScrapeSourceFilterPanelComponent,
    BulkScopeSelectorComponent,
    BulkActionDialogComponent,
  ],
  templateUrl: './delete-sources.component.html',
})
export class DeleteSourcesComponent implements OnChanges {
  @Input() selectedSources: ScrapeSourceInfo[] = [];
  /** Total records in the workspace, not just the loaded page. */
  @Input() totalCount: number | null = null;
  @Input() allSources: ScrapeSourceInfo[] = [];
  @Output() sourcesDeleted = new EventEmitter<void>();

  dialogVisible = false;
  private readonly locale = inject(LOCALE_ID);
  isDeleting = false;
  deleteOption: 'all' | 'selected' | null = null;
  deleteForm: FormGroup;

  private readonly defaultFormValues: DeleteSourcesFormDefaults = {
    filter: false,
    http: true,
    https: true,
    proxyCountOperator: '>',
    proxyCount: 0,
    aliveCountOperator: '>',
    aliveCount: 0,
  };

  constructor(
    private fb: FormBuilder,
    private http: HttpService,
    private notification: NotificationService,
  ) {
    this.deleteForm = this.fb.group({
      filter: [this.defaultFormValues.filter],
      http: [this.defaultFormValues.http],
      https: [this.defaultFormValues.https],
      proxyCountOperator: [this.defaultFormValues.proxyCountOperator],
      proxyCount: [this.defaultFormValues.proxyCount],
      aliveCountOperator: [this.defaultFormValues.aliveCountOperator],
      aliveCount: [this.defaultFormValues.aliveCount],
    });
  }

  clearDeleteFilters(): void {
    this.deleteForm.patchValue({
      http: false,
      https: false,
      proxyCountOperator: this.defaultFormValues.proxyCountOperator,
      proxyCount: 0,
      aliveCountOperator: this.defaultFormValues.aliveCountOperator,
      aliveCount: 0,
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedSources'] && this.deleteOption === 'selected' && !this.canDeleteSelected()) {
      this.deleteOption = null;
    }
  }

  openDialog(): void {
    if (!this.hasAnySources()) {
      this.notification.showError('No scrape sources available to delete.');
      return;
    }

    // Deleting everything must be an explicit choice, so nothing is preselected without a selection.
    this.deleteOption = this.canDeleteSelected() ? 'selected' : null;
    this.dialogVisible = true;
  }

  get filtersEnabled(): boolean {
    return Boolean(this.deleteForm.get('filter')?.value);
  }

  get allScopeTitle(): string {
    const total = this.totalCount;
    if (this.filtersEnabled) return 'All matching sources';
    return total !== null && total >= 0 ? `All sources (${formatNumber(total, this.locale)})` : 'All sources';
  }

  get confirmLabel(): string {
    if (this.deleteOption !== 'all') return '';
    return this.filtersEnabled
      ? 'I understand that every source matching these filters will be permanently deleted.'
      : 'I understand that every source in this workspace will be permanently deleted.';
  }

  get actionLabel(): string {
    if (this.deleteOption === 'selected') {
      const count = this.selectedSources.length;
      return `Delete ${formatNumber(count, this.locale)} selected ${count === 1 ? 'source' : 'sources'}`;
    }
    if (this.deleteOption === 'all') return this.filtersEnabled ? 'Delete matching sources' : 'Delete all sources';
    return 'Choose what to delete';
  }

  closeDialog(): void {
    this.dialogVisible = false;
  }

  onDialogHide(): void {
    this.resetFormState();
  }

  hasAnySources(): boolean {
    return (this.allSources?.length ?? 0) > 0 || (this.selectedSources?.length ?? 0) > 0;
  }

  canDeleteSelected(): boolean {
    return (this.selectedSources?.length ?? 0) > 0;
  }

  submitDelete(): void {
    if (!this.deleteOption) {
      return;
    }
    if (this.deleteOption === 'selected' && !this.canDeleteSelected()) {
      this.notification.showError('No scrape sources selected for deletion.');
      return;
    }

    const deleteSettings = this.transformFormToDelete(this.deleteForm, this.deleteOption);
    if (deleteSettings.scope === 'selected' && deleteSettings.scrapeSources.length === 0) {
      this.notification.showError('No scrape sources selected for deletion.');
      return;
    }

    this.isDeleting = true;

    this.http.deleteScrapingSource(deleteSettings).subscribe({
      next: res => {
        const message = res;
        const normalized = message.trim().toLowerCase();

        if (normalized.includes('no scraping sources')) {
          this.notification.showInfo(message);
        } else {
          this.notification.showSuccess(message);
        }

        this.isDeleting = false;
        this.closeDialog();
        this.sourcesDeleted.emit();
      },
      error: err => {
        this.isDeleting = false;
        const message = err?.error?.message ?? err?.error?.error ?? err?.message ?? 'Unknown error';
        this.notification.showError('Could not delete scrape sources: ' + message);
      }
    });
  }

  private resetFormState(): void {
    this.deleteForm.reset(this.defaultFormValues);
    this.deleteOption = null;
    this.isDeleting = false;
  }

  private transformFormToDelete(form: FormGroup, scope: 'all' | 'selected'): ScrapeSourceDeleteSettings {
    const formValue = form.getRawValue();
    const sources = scope === 'selected' ? this.selectedSources : [];
    const filtersEnabled = Boolean(formValue.filter);

    return {
      scrapeSources: sources.map(source => source.id),
      filter: filtersEnabled,
      http: filtersEnabled ? Boolean(formValue.http) : false,
      https: filtersEnabled ? Boolean(formValue.https) : false,
      proxyCountOperator: formValue.proxyCountOperator === '<' ? '<' : '>',
      proxyCount: filtersEnabled ? normalizeNumber(formValue.proxyCount) : 0,
      aliveCountOperator: formValue.aliveCountOperator === '<' ? '<' : '>',
      aliveCount: filtersEnabled ? normalizeNumber(formValue.aliveCount) : 0,
      scope,
    };
  }
}
