import {HlmButton} from '@spartan-ng/helm/button';
import {HlmBadge} from '@spartan-ng/helm/badge';
import {HlmSwitch} from '@spartan-ng/helm/switch';
import {HlmDropdownMenuImports} from '@spartan-ng/helm/dropdown-menu';
import {CdkDragDrop, DragDropModule, moveItemInArray} from '@angular/cdk/drag-drop';
import {HlmInput} from '@spartan-ng/helm/input';
import {SelectComponent} from '../../shared/ui/select.component';
import {ChangeDetectorRef, Component, OnDestroy, OnInit, effect, signal} from '@angular/core';
import {FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';

import {SettingsService} from '../../services/settings.service';
import {NotificationService} from '../../services/notification-service.service';
import {CheckerProtocol, CheckerSettings, TagCheckerRule, UserSettings} from '../../models/UserSettings';
import {ProxyTagService} from '../../services/proxy-tag.service';
import {ProxyTagManagerComponent} from '../../shared/proxy-tag-manager/proxy-tag-manager.component';
import {Subject} from 'rxjs';
import {filter, finalize, takeUntil} from 'rxjs/operators';
import {WorkspaceService} from '../../services/workspace.service';

@Component({
  selector: 'app-checker-settings',
  standalone: true,
  imports: [HlmButton, HlmInput, HlmSwitch, HlmDropdownMenuImports, SelectComponent, ReactiveFormsModule, ProxyTagManagerComponent, HlmBadge, DragDropModule],
  templateUrl: './checker-settings.component.html',
  styleUrls: ['./checker-settings.component.scss']
})
export class CheckerSettingsComponent implements OnInit, OnDestroy {
  settingsForm: FormGroup;
  readonly selectedProfile = new FormControl<number>(0, {nonNullable: true});
  readonly saving = signal(false);
  settingsLoaded = false;
  readonly ruleModes: {label: string; value: TagCheckerRule['mode']}[] = [{label: 'Replace', value: 'replace'}, {label: 'Add', value: 'add'}, {label: 'Remove', value: 'remove'}];
  readonly modeHelp: Record<string, string> = {
    replace: 'Proxies with this tag ignore the Default protocols and use only the ones selected here.',
    add: 'Proxies with this tag keep the Default protocols and add the ones selected here.',
    remove: 'Proxies with this tag keep the Default protocols except the ones selected here. Transport, timeout and retries are not changed.',
  };
  readonly numericFields = [
    {control: 'Timeout' as const, id: 'timeout', label: 'Timeout', description: 'How long one attempt may take.', unit: 'ms', placeholder: '7500', min: 1, max: 65535},
    {control: 'Retries' as const, id: 'retries', label: 'Retries', description: 'Extra attempts after the first one fails.', unit: 'retries', placeholder: '2', min: 0, max: 255},
  ];
  readonly protocolOptions = [
    {label: 'HTTP', control: 'HTTPProtocol', key: 'http' as CheckerProtocol},
    {label: 'HTTPS', control: 'HTTPSProtocol', key: 'https' as CheckerProtocol},
    {label: 'SOCKS4', control: 'SOCKS4Protocol', key: 'socks4' as CheckerProtocol},
    {label: 'SOCKS5', control: 'SOCKS5Protocol', key: 'socks5' as CheckerProtocol},
  ];
  transportProtocolOptions = [
    { label: 'TCP', value: 'tcp' },
    { label: 'QUIC', value: 'quic' },
    { label: 'HTTP/3', value: 'http3' },
  ];
  readonly failureActionOptions = [
    {label: 'Pause', value: 'pause'},
    {label: 'Delete', value: 'delete'},
  ];
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private changeDetector: ChangeDetectorRef,
    private settingsService: SettingsService,
    private notification: NotificationService,
    readonly workspaces: WorkspaceService,
    readonly tags: ProxyTagService,
  ) {
    this.settingsForm = this.createForm();
    this.configureAutoRemoveThresholdToggle();
    effect(() => this.syncPermissions(this.workspaces.canOperate()));
  }

  ngOnInit(): void {
    this.populateForm(this.settingsService.getUserSettings());
    this.tags.load().pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.onTagsChanged(),
      error: error => this.notification.showError(error?.error?.error ?? 'Could not load proxy tags'),
    });

    this.settingsService.userSettings$
      .pipe(
        filter((settings): settings is UserSettings => !!settings),
        takeUntil(this.destroy$)
      )
      .subscribe(settings => this.populateForm(settings));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get rules(): FormArray<FormGroup> { return this.settingsForm.get('Rules') as FormArray<FormGroup>; }
  get tagsWithoutRule() {
    const used = new Set(this.rules.controls.map(rule => rule.get('TagID')?.value));
    return this.tags.tags().filter(tag => !used.has(tag.id));
  }
  get selectedRule(): FormGroup | undefined { return this.rules.controls.find(rule => rule.get('TagID')?.value === this.selectedProfile.value); }
  get editingDefault(): boolean { return this.selectedProfile.value === 0; }
  get profileForm(): FormGroup { return this.selectedRule ?? this.settingsForm; }
  get removeMode(): boolean { return this.selectedRule?.get('Mode')?.value === 'remove'; }
  get protocolHeading(): string {
    const mode = this.selectedRule?.get('Mode')?.value;
    return mode === 'replace' ? 'Use only these protocols' : mode === 'add' ? 'Also check these protocols' : mode === 'remove' ? 'Stop checking these protocols' : 'Protocols';
  }
  get protocolMark(): string {
    const mode = this.selectedRule?.get('Mode')?.value;
    return mode === 'remove' ? '−' : mode === 'add' ? '+' : '✓';
  }
  get defaultProtocolList(): string {
    const labels = this.protocolOptions.filter(p => this.settingsForm.get(p.control)?.value).map(p => p.label);
    if (labels.length === 0) { return 'no protocols'; }
    return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  }
  get unsavedSummary(): string {
    const names = this.rules.controls.filter(rule => rule.dirty).map(rule => this.tagName(rule.get('TagID')?.value));
    const defaultDirty = Object.entries(this.settingsForm.controls).some(([name, control]) => name !== 'Rules' && control.dirty);
    if (defaultDirty) { names.unshift('Default'); }
    if (names.length === 0) { return 'Unsaved changes to tag rules'; }
    if (names.length > 3) { return `Unsaved changes to ${names.length} profiles`; }
    return `Unsaved changes to ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`}`;
  }
  get totalAttempts(): number { return Number(this.profileForm.get('Retries')?.value ?? this.settingsForm.get('Retries')?.value ?? 0) + 1; }
  get configuredAttemptWindow(): string {
    const timeout = Number(this.profileForm.get('Timeout')?.value ?? this.settingsForm.get('Timeout')?.value ?? 0);
    const milliseconds = Math.max(0, timeout * this.totalAttempts);
    if (milliseconds < 1000) { return `${Math.round(milliseconds)} ms`; }
    const seconds = milliseconds / 1000;
    return seconds < 60 ? `${Number(seconds.toFixed(seconds >= 10 ? 0 : 1))} sec` : `${Number((seconds / 60).toFixed(1))} min`;
  }
  get cleanupThreshold(): number {
    const threshold = Number(this.settingsForm.get('AutoRemoveFailureThreshold')?.value ?? 1);
    return Math.min(Math.max(Math.round(Number.isFinite(threshold) ? threshold : 1), 1), 255);
  }
  get deleteOnFailure(): boolean { return this.settingsForm.get('FailureAction')?.value === 'delete'; }
  tagName(id: number): string { return this.tags.tags().find(tag => tag.id === id)?.name ?? `Tag ${id}`; }
  tagColor(id: number): string { return this.tags.tags().find(tag => tag.id === id)?.color ?? 'var(--muted-foreground)'; }
  transportLabel(value: string | null | undefined): string { return this.transportProtocolOptions.find(option => option.value === value)?.label ?? 'TCP'; }
  transportHint(value: string | null | undefined): string {
    if (value === 'quic') { return 'HTTP/3 with datagram support. Proxy and judge both need HTTP/3.'; }
    if (value === 'http3') { return 'HTTP/3 over reliable QUIC streams. Proxy and judge both need HTTP/3.'; }
    return 'Broadest compatibility. Works with standard HTTP judges.';
  }
  inherits(field: 'Timeout' | 'Retries' | 'TransportProtocol'): boolean {
    return !this.editingDefault && this.profileForm.get(field)?.value == null;
  }

  selectProfile(id: number): void { this.selectedProfile.setValue(id); }

  toggleProtocol(controlName: string): void {
    if (!this.workspaces.canOperate() || this.saving()) { return; }
    const control = this.profileForm.get(controlName);
    control?.setValue(!control.value);
    control?.markAsDirty();
  }
  setInherited(field: 'Timeout' | 'Retries' | 'TransportProtocol', inherit: boolean): void {
    if (!this.workspaces.canOperate() || this.editingDefault || this.removeMode) { return; }
    const control = this.profileForm.get(field)!;
    control.setValue(inherit ? null : this.settingsForm.get(field)?.value);
    control.markAsDirty();
  }
  addRule(): void {
    if (!this.workspaces.canOperate() || this.editingDefault || this.selectedRule) { return; }
    const rule = this.ruleForm({tag_id: this.selectedProfile.value, mode: 'add', protocols: []});
    this.rules.push(rule);
    rule.markAsDirty();
  }
  addRuleFor(tagId: number): void {
    if (!this.workspaces.canOperate()) { return; }
    this.selectedProfile.setValue(tagId);
    this.addRule();
  }
  setMode(mode: TagCheckerRule['mode']): void {
    const control = this.selectedRule?.get('Mode');
    if (!this.workspaces.canOperate() || !control || control.value === mode) { return; }
    control.setValue(mode);
    control.markAsDirty();
  }
  removeRule(): void {
    if (!this.workspaces.canOperate() || !this.selectedRule) { return; }
    this.rules.removeAt(this.rules.controls.indexOf(this.selectedRule));
    this.rules.markAsDirty();
    this.selectedProfile.setValue(0);
  }
  /** Moves a tag rule in the priority order. The first rule has the highest priority and applies last. */
  moveRule(from: number, to: number): void {
    if (!this.workspaces.canOperate() || from === to || from < 0 || to < 0 || from >= this.rules.length || to >= this.rules.length) { return; }
    const order = [...this.rules.controls];
    moveItemInArray(order, from, to);
    this.settingsForm.setControl('Rules', this.fb.array(order));
    this.rules.markAsDirty();
  }
  dropRule(event: CdkDragDrop<unknown>): void {
    if (!event.isPointerOverContainer) { return; }
    this.moveRule(event.previousIndex, event.currentIndex);
  }
  discardChanges(): void {
    if (this.saving()) { return; }
    this.populateForm(this.settingsService.getUserSettings(), true);
    if (!this.editingDefault && !this.selectedRule) { this.selectedProfile.setValue(0); }
  }
  onTagsChanged(): void {
    const ids = new Set(this.tags.tags().map(tag => tag.id));
    for (let i = this.rules.length - 1; i >= 0; i--) {
      if (!ids.has(this.rules.at(i).get('TagID')?.value)) { this.rules.removeAt(i); this.rules.markAsDirty(); }
    }
    if (!this.editingDefault && !this.selectedRule) { this.selectedProfile.setValue(0); }
  }
  private profileControls(protocols: readonly CheckerProtocol[], transport: string | null, timeout: number | null, retries: number | null, required = false) {
    const integer = Validators.pattern(/^\d+$/);
    return {
      ...Object.fromEntries(this.protocolOptions.map(p => [p.control, [protocols.includes(p.key)]])),
      TransportProtocol: [transport, required ? Validators.required : []],
      Timeout: [timeout, [Validators.min(1), Validators.max(65535), integer, ...(required ? [Validators.required] : [])]],
      Retries: [retries, [Validators.min(0), Validators.max(255), integer, ...(required ? [Validators.required] : [])]],
    };
  }
  private ruleForm(rule: TagCheckerRule): FormGroup {
    const group = this.fb.group({TagID: [rule.tag_id], Mode: [rule.mode], ...this.profileControls(rule.protocols, rule.transport ?? null, rule.timeout ?? null, rule.retries ?? null)});
    const sync = () => {
      const enabled = group.get('Mode')?.value !== 'remove' && this.workspaces.canOperate();
      for (const field of ['TransportProtocol', 'Timeout', 'Retries']) { enabled ? group.get(field)?.enable({emitEvent: false}) : group.get(field)?.disable({emitEvent: false}); }
    };
    group.get('Mode')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(sync);
    sync();
    return group;
  }
  serializeProfiles(): CheckerSettings {
    const selected = (group: FormGroup) => this.protocolOptions.filter(p => group.get(p.control)?.value).map(p => p.key);
    const values = this.settingsForm.getRawValue();
    const rules: TagCheckerRule[] = this.rules.controls.map(group => {
      const fields = group.getRawValue();
      const rule: TagCheckerRule = {tag_id: fields.TagID, mode: fields.Mode, protocols: selected(group)};
      if (rule.mode !== 'remove') {
        if (fields.TransportProtocol != null) { rule.transport = fields.TransportProtocol; }
        if (fields.Timeout != null) { rule.timeout = Number(fields.Timeout); }
        if (fields.Retries != null) { rule.retries = Number(fields.Retries); }
      }
      return rule;
    });
    return {defaults: {protocols: selected(this.settingsForm), transport: values.TransportProtocol, timeout: Number(values.Timeout), retries: Number(values.Retries)}, rules};
  }
  private createForm(): FormGroup {
    return this.fb.group({
      ...this.profileControls(['https'], 'tcp', 7500, 2, true),
      Rules: this.fb.array([]),
      UseHttpsForSocks: [true],
      AutoRemoveFailingProxies: [false],
      AutoRemoveFailureThreshold: [3, [Validators.min(1), Validators.max(255)]],
      FailureAction: ['pause'],
    });
  }
  private populateForm(settings: UserSettings | undefined, force = false): void {
    if (!settings || (this.settingsForm.dirty && !force && !this.saving())) { return; }
    const defaults = settings.checker_settings?.defaults ?? {
      protocols: this.protocolOptions.filter(p => settings[p.key + '_protocol' as keyof UserSettings]).map(p => p.key),
      transport: settings.transport_protocol || 'tcp', timeout: settings.timeout, retries: settings.retries,
    };
    this.settingsForm.patchValue({
      ...Object.fromEntries(this.protocolOptions.map(p => [p.control, defaults.protocols.includes(p.key)])),
      Timeout: defaults.timeout, Retries: defaults.retries, TransportProtocol: defaults.transport,
      UseHttpsForSocks: settings.UseHttpsForSocks,
      AutoRemoveFailingProxies: settings.auto_remove_failing_proxies,
      AutoRemoveFailureThreshold: settings.auto_remove_failure_threshold,
      FailureAction: settings.failure_action === 'delete' ? 'delete' : 'pause',
    });
    this.settingsForm.setControl('Rules', this.fb.array((settings.checker_settings?.rules ?? []).map(rule => this.ruleForm(rule))));
    if (!this.workspaces.canOperate()) { this.settingsForm.disable({emitEvent: false}); }
    this.settingsForm.markAsPristine();
    this.settingsLoaded = true;
    this.changeDetector.markForCheck();
  }
  onSubmit(): void {
    if (!this.workspaces.canOperate() || this.saving() || !this.settingsLoaded) { return; }
    this.settingsForm.get('AutoRemoveFailureThreshold')?.setValue(this.cleanupThreshold, {emitEvent: false});
    if (this.settingsForm.invalid) { this.notification.showError('Check the checker settings before saving'); return; }
    const payload = {...this.settingsForm.getRawValue(), checker_settings: this.serializeProfiles()};
    payload.AutoRemoveFailureThreshold = this.cleanupThreshold;
    this.saving.set(true);
    this.settingsService.saveUserSettings(payload).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: resp => {
        this.notification.showSuccess(resp.message);
        this.populateForm({...this.settingsService.getUserSettings()!, checker_settings: payload.checker_settings}, true);
      },
      error: err => {
        this.settingsForm.markAsDirty();
        this.notification.showError(err?.error?.message ?? err?.error?.error ?? 'Failed to save settings!');
      }
    });
  }

  private syncPermissions(canOperate: boolean): void {
    if (!canOperate) { this.settingsForm.disable({emitEvent: false}); return; }
    this.settingsForm.enable({emitEvent: false});
    for (const rule of this.rules.controls) {
      if (rule.get('Mode')?.value === 'remove') {
        for (const field of ['TransportProtocol', 'Timeout', 'Retries']) { rule.get(field)?.disable({emitEvent: false}); }
      }
    }
    if (!this.settingsForm.get('AutoRemoveFailingProxies')?.value) {
      this.settingsForm.get('AutoRemoveFailureThreshold')?.disable({emitEvent: false});
      this.settingsForm.get('FailureAction')?.disable({emitEvent: false});
    }
  }

  private configureAutoRemoveThresholdToggle(): void {
    const autoRemoveControl = this.settingsForm.get('AutoRemoveFailingProxies');
    const thresholdControl = this.settingsForm.get('AutoRemoveFailureThreshold');
    const actionControl = this.settingsForm.get('FailureAction');

    if (!autoRemoveControl || !thresholdControl || !actionControl) {
      return;
    }

    const syncThresholdState = (isEnabled: boolean): void => {
      if (isEnabled && this.workspaces.canOperate()) {
        thresholdControl.enable({emitEvent: false});
        actionControl.enable({emitEvent: false});
      } else {
        thresholdControl.disable({emitEvent: false});
        actionControl.disable({emitEvent: false});
      }
    };

    syncThresholdState(!!autoRemoveControl.value);

    autoRemoveControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => syncThresholdState(!!value));
  }
}
