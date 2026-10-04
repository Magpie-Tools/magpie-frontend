import {HlmButton} from '@spartan-ng/helm/button';
import {HlmPopoverImports} from '@spartan-ng/helm/popover';
import {HlmBadge} from '@spartan-ng/helm/badge';
import {CdkDragDrop, DragDropModule, moveItemInArray} from '@angular/cdk/drag-drop';
import {TooltipComponent} from '../../tooltip/tooltip.component';
import {HlmInput} from '@spartan-ng/helm/input';
import {SelectComponent} from '../../shared/ui/select.component';
import {AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, effect, signal} from '@angular/core';
import {FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {CheckboxComponent} from '../../checkbox/checkbox.component';

import {SettingsService} from '../../services/settings.service';
import {NotificationService} from '../../services/notification-service.service';
import {CheckerProtocol, CheckerSettings, TagCheckerRule, UserSettings} from '../../models/UserSettings';
import {ProxyTagService} from '../../services/proxy-tag.service';
import {ProxyTagManagerComponent} from '../../shared/proxy-tag-manager/proxy-tag-manager.component';
import {Subject} from 'rxjs';
import {filter, takeUntil} from 'rxjs/operators';
import {WorkspaceService} from '../../services/workspace.service';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-checker-settings',
  standalone: true,
  imports: [HlmButton, HlmInput, SelectComponent, ReactiveFormsModule, CheckboxComponent, ProxyTagManagerComponent, TooltipComponent, HlmBadge, HlmPopoverImports, DragDropModule],
  templateUrl: './checker-settings.component.html',
  styleUrls: ['./checker-settings.component.scss']
})
export class CheckerSettingsComponent implements OnInit, AfterViewInit, OnDestroy {
  settingsForm: FormGroup;
  readonly selectedProfile = new FormControl<number>(0, {nonNullable: true});
  readonly priorityOpen = signal(false);
  readonly priorityDraft = signal<number[]>([]);
  priorityDragging = false;
  saving = false;
  settingsLoaded = false;
  readonly ruleModes = [{label: 'Replace', value: 'replace'}, {label: 'Add', value: 'add'}, {label: 'Remove', value: 'remove'}];
  readonly protocolOptions = [
    {
      label: 'HTTP',
      control: 'HTTPProtocol', key: 'http' as CheckerProtocol,
      icon: 'icon icon-globe',
      description: 'Standard web proxies',
    },
    {
      label: 'HTTPS',
      control: 'HTTPSProtocol', key: 'https' as CheckerProtocol,
      icon: 'icon icon-lock',
      description: 'Encrypted web traffic',
    },
    {
      label: 'SOCKS4',
      control: 'SOCKS4Protocol', key: 'socks4' as CheckerProtocol,
      icon: 'icon icon-network',
      description: 'IPv4 socket routing',
    },
    {
      label: 'SOCKS5',
      control: 'SOCKS5Protocol', key: 'socks5' as CheckerProtocol,
      icon: 'icon icon-shield',
      description: 'Modern socket routing',
    },
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
  readonly transportProtocolTooltip =
    'TCP uses standard HTTP over TCP. QUIC and HTTP/3 both use HTTP/3 over QUIC; QUIC enables HTTP/3 datagrams (unreliable messages), HTTP/3 uses streams only.';
  private destroy$ = new Subject<void>();
  private animationContext?: gsap.Context;

  constructor(
    private fb: FormBuilder,
    private changeDetector: ChangeDetectorRef,
    private settingsService: SettingsService,
    private notification: NotificationService,
    private elementRef: ElementRef<HTMLElement>,
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

  ngAfterViewInit(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const host = this.elementRef.nativeElement;
    const scrollContainer = host.closest('main') as HTMLElement | null;
    const scroller = scrollContainer ?? undefined;

    this.animationContext = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.settings-card').forEach((card, index) => {
        gsap.from(card, {
          opacity: 0,
          y: 28,
          scale: 0.985,
          duration: 0.7,
          delay: index * 0.04,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            scroller,
            start: 'top 94%',
            toggleActions: 'play none none reverse',
          },
        });
      });
    }, host);

    requestAnimationFrame(() => ScrollTrigger.refresh());
  }

  ngOnDestroy(): void {
    this.animationContext?.revert();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get rules(): FormArray<FormGroup> { return this.settingsForm.get('Rules') as FormArray<FormGroup>; }
  get profileOptions() { return [{label: 'Default', value: 0}, ...this.tags.tags().map(tag => ({label: tag.name, value: tag.id}))]; }
  get selectedRule(): FormGroup | undefined { return this.rules.controls.find(rule => rule.get('TagID')?.value === this.selectedProfile.value); }
  get editingDefault(): boolean { return this.selectedProfile.value === 0; }
  get profileForm(): FormGroup { return this.selectedRule ?? this.settingsForm; }
  get removeMode(): boolean { return this.selectedRule?.get('Mode')?.value === 'remove'; }
  get selectedProtocolCount(): number { return this.protocolOptions.filter(p => this.profileForm.get(p.control)?.value).length; }
  get transportOptions() { return this.editingDefault ? this.transportProtocolOptions : [{label: 'Inherit', value: null}, ...this.transportProtocolOptions]; }
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
  ruleMode(id: number): string { return this.rules.controls.find(rule => rule.get('TagID')?.value === id)?.get('Mode')?.value ?? ''; }

  toggleProtocol(controlName: string): void {
    if (!this.workspaces.canOperate() || this.saving) { return; }
    const control = this.profileForm.get(controlName);
    control?.setValue(!control.value);
    control?.markAsDirty();
  }
  setInherited(field: 'Timeout' | 'Retries', inherit: boolean): void {
    if (!this.workspaces.canOperate() || this.editingDefault || this.removeMode) { return; }
    const control = this.profileForm.get(field)!;
    control.setValue(inherit ? null : this.settingsForm.get(field)?.value);
    control.markAsDirty();
  }
  addRule(): void {
    if (!this.workspaces.canOperate() || this.editingDefault || this.selectedRule) { return; }
    this.rules.push(this.ruleForm({tag_id: this.selectedProfile.value, mode: 'add', protocols: []}));
    this.rules.markAsDirty();
  }
  removeRule(): void {
    if (!this.workspaces.canOperate() || !this.selectedRule) { return; }
    this.rules.removeAt(this.rules.controls.indexOf(this.selectedRule));
    this.rules.markAsDirty();
  }
  onPriorityStateChanged(state: string): void {
    if (state === 'closed' && this.priorityDragging) { return; }
    this.priorityOpen.set(state === 'open');
    if (state === 'open') { this.priorityDraft.set(this.rules.controls.map(rule => rule.get('TagID')?.value)); }
  }
  movePriority(index: number, direction: number): void {
    const next = index + direction;
    if (!this.workspaces.canOperate() || next < 0 || next >= this.priorityDraft().length) { return; }
    const order = [...this.priorityDraft()];
    moveItemInArray(order, index, next);
    this.priorityDraft.set(order);
  }
  dropPriority(event: CdkDragDrop<number[]>): void {
    if (!this.workspaces.canOperate() || !event.isPointerOverContainer) { return; }
    const order = [...this.priorityDraft()];
    moveItemInArray(order, event.previousIndex, event.currentIndex);
    this.priorityDraft.set(order);
  }
  applyPriority(): void {
    if (!this.workspaces.canOperate()) { return; }
    const groups = this.rules.controls;
    const order = this.priorityDraft();
    if (order.length !== groups.length || new Set(order).size !== groups.length) { return; }
    const reordered = order.map(id => groups.find(rule => rule.get('TagID')?.value === id));
    if (reordered.some(rule => !rule)) { return; }
    if (reordered.some((rule, index) => rule !== groups[index])) {
      this.settingsForm.setControl('Rules', this.fb.array(reordered as FormGroup[]));
      this.rules.markAsDirty();
    }
    this.priorityOpen.set(false);
  }
  onTagsChanged(): void {
    const ids = new Set(this.tags.tags().map(tag => tag.id));
    for (let i = this.rules.length - 1; i >= 0; i--) {
      if (!ids.has(this.rules.at(i).get('TagID')?.value)) { this.rules.removeAt(i); this.rules.markAsDirty(); }
    }
    if (!this.editingDefault && !ids.has(this.selectedProfile.value)) { this.selectedProfile.setValue(0); }
    this.priorityOpen.set(false);
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
    if (!settings || (this.settingsForm.dirty && !force && !this.saving)) { return; }
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
    if (!this.workspaces.canOperate() || this.saving || !this.settingsLoaded) { return; }
    this.settingsForm.get('AutoRemoveFailureThreshold')?.setValue(this.cleanupThreshold, {emitEvent: false});
    if (this.settingsForm.invalid) { this.notification.showError('Check the checker settings before saving'); return; }
    const payload = {...this.settingsForm.getRawValue(), checker_settings: this.serializeProfiles()};
    payload.AutoRemoveFailureThreshold = this.cleanupThreshold;
    this.saving = true;
    this.settingsService.saveUserSettings(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: resp => {
        this.saving = false;
        this.notification.showSuccess(resp.message);
        this.populateForm({...this.settingsService.getUserSettings()!, checker_settings: payload.checker_settings}, true);
      },
      error: err => {
        this.saving = false;
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
