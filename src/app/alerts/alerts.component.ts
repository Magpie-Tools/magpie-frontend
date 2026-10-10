import {CommonModule} from '@angular/common';
import {afterNextRender, Component, computed, DestroyRef, effect, ElementRef, Injector, signal, untracked} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {BrnHoverCardImports} from '@spartan-ng/brain/hover-card';
import {HlmInput} from '@spartan-ng/helm/input';
import {HlmSkeleton} from '@spartan-ng/helm/skeleton';
import {HlmTabsImports} from '@spartan-ng/helm/tabs';
import {Observable, Subscription, timer} from 'rxjs';
import {AlertChannel, AlertDelivery, AlertDestination, AlertDestinationWrite, AlertIncident, AlertMentionMode, AlertMetric, AlertRotator, AlertRule, AlertRuleWrite, AlertsPage} from '../models/Alert';
import {AlertsService} from '../services/alerts.service';
import {WorkspaceService} from '../services/workspace.service';
import {NotificationService} from '../services/notification-service.service';
import {SelectComponent} from '../shared/ui/select.component';
import {VisibleRowsDirective} from '../shared/visible-rows.directive';

const emptyPage = (): AlertsPage => ({rules: [], destinations: [], incidents: [], deliveries: [], next_cursor: 0});
const emptyRule = () => ({name: '', rotator_id: null as number | null, metric: 'usable_routes' as AlertMetric, threshold: null as number | null, enabled: true, destination_ids: [] as number[]});
const emptyDestination = () => ({name: '', kind: 'email' as AlertChannel, enabled: true, target: '', signing_secret: '', clear_signing_secret: false, mention_mode: 'none' as AlertMentionMode, mention_id: ''});

@Component({
  selector: 'app-alerts', standalone: true,
  imports: [CommonModule, FormsModule, BrnHoverCardImports, HlmInput, HlmSkeleton, HlmTabsImports, SelectComponent, VisibleRowsDirective],
  templateUrl: './alerts.component.html', styleUrl: './alerts.component.scss',
})
export class AlertsComponent {
  readonly page = signal<AlertsPage>(emptyPage());
  readonly rotators = signal<AlertRotator[]>([]);
  readonly rotatorsLoading = signal(false);
  readonly rotatorsLoaded = signal(false);
  readonly rotatorsError = signal(false);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly loaded = signal(false);
  readonly activeSection = signal('rules');
  readonly enabledRuleCount = computed(() => this.page().rules.filter(rule => rule.enabled).length);
  readonly openIncidentCount = computed(() => new Set(this.page().rules.flatMap(rule => rule.active_incident_id ? [rule.active_incident_id] : [])).size);
  readonly destinationsById = computed(() => new Map(this.page().destinations.map(destination => [destination.id, destination])));
  readonly sections = [
    {id: 'rules', label: 'Alert rules', icon: 'icon-sliders-horizontal'},
    {id: 'destinations', label: 'Destinations', icon: 'icon-send'},
    {id: 'history', label: 'Incident history', icon: 'icon-history'},
  ];
  readonly confirmDelete = signal<{kind: 'rule' | 'destination'; id: number; name: string} | null>(null);
  readonly metrics: {value: AlertMetric; label: string}[] = [
    {value: 'usable_routes', label: 'Usable routes below minimum'},
    {value: 'success_rate', label: 'Checker success rate below minimum'},
    {value: 'latency_ms', label: 'Average successful-check latency above maximum'},
  ];
  readonly channels: AlertChannel[] = ['email', 'slack', 'discord', 'webhook'];
  readonly channelOptions = this.channels.map(value => ({value, label: value.charAt(0).toUpperCase() + value.slice(1)}));
  rule = emptyRule();
  destination = emptyDestination();
  editingRuleId: number | null = null;
  editingDestinationId: number | null = null;
  cursor = 0;
  private requestVersion = 0;
  private rotatorsVersion = 0;
  private actionVersion = 0;
  private pageRequest?: Subscription;
  private rotatorsRequest?: Subscription;

  constructor(private readonly api: AlertsService, public readonly workspace: WorkspaceService,
              private readonly notification: NotificationService, private readonly destroyRef: DestroyRef,
              private readonly host: ElementRef<HTMLElement>, private readonly injector: Injector) {
    effect(() => {
      const workspaceId = workspace.current()?.id;
      untracked(() => {
        this.pageRequest?.unsubscribe(); this.rotatorsRequest?.unsubscribe();
        this.requestVersion++; this.rotatorsVersion++; this.actionVersion++; this.page.set(emptyPage()); this.rotators.set([]);
        this.rotatorsLoading.set(false); this.rotatorsLoaded.set(false); this.rotatorsError.set(false);
        this.loading.set(!!workspaceId);
        this.loaded.set(false); this.busy.set(false); this.error.set(''); this.cursor = 0; this.activeSection.set('rules');
        this.cancelRule(); this.cancelDestination(); this.confirmDelete.set(null);
        if (workspaceId) { this.load(); this.loadRotators(); }
      });
    });
    timer(60_000, 60_000).pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      if (!this.busy() && !this.loading() && this.cursor === 0 && this.loaded()) this.load(0, true);
    });
  }

  load(before = 0, silent = false): void {
    const workspaceId = this.workspace.current()?.id;
    if (!workspaceId) return;
    this.pageRequest?.unsubscribe();
    const version = ++this.requestVersion;
    this.cursor = before; this.error.set('');
    if (!silent) this.loading.set(true);
    this.pageRequest = this.api.load(before).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: page => {
        if (version !== this.requestVersion || workspaceId !== this.workspace.current()?.id) return;
        this.page.set(page); this.loaded.set(true); this.loading.set(false);
      },
      error: err => {
        if (version !== this.requestVersion || workspaceId !== this.workspace.current()?.id) return;
        this.error.set(this.errorMessage(err)); this.loading.set(false);
      },
    });
  }
  refresh(): void { this.load(); this.loadRotators(); }
  selectSection(tab: string): void {
    const section = this.sections.find(section => 'alerts-' + section.id === tab);
    if (section) this.activeSection.set(section.id);
  }
  loadRotators(): void {
    const workspaceId = this.workspace.current()?.id;
    if (!workspaceId || this.rotatorsLoading()) return;
    const version = ++this.rotatorsVersion;
    this.rotatorsLoading.set(true); this.rotatorsError.set(false);
    this.rotatorsRequest = this.api.rotators().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rotators => {
        if (version !== this.rotatorsVersion || workspaceId !== this.workspace.current()?.id) return;
        this.rotators.set(rotators); this.rotatorsLoaded.set(true); this.rotatorsLoading.set(false);
      },
      error: () => {
        if (version !== this.rotatorsVersion || workspaceId !== this.workspace.current()?.id) return;
        this.rotatorsError.set(true); this.rotatorsLoading.set(false);
      },
    });
  }
  metricLabel(metric: AlertMetric): string {
    return metric === 'usable_routes' ? 'Usable routes' : metric === 'success_rate' ? 'Checker success rate' : 'Average successful-check latency';
  }
  scopeName(id: number | null): string {
    if (id === null) return 'Whole workspace';
    return this.rotators().find(r => r.id === id)?.name
      ?? (this.rotatorsLoaded() && !this.rotatorsError() && !this.rotatorsLoading() ? `Deleted rotator #${id}` : `Rotator #${id}`);
  }
  missingDraftRotator(): boolean { return this.rule.rotator_id !== null && !this.rotators().some(r => r.id === this.rule.rotator_id); }
  scopeOptions(): {label: string; value: number | null}[] {
    return [
      {label: 'Whole workspace', value: null},
      ...(this.missingDraftRotator() ? [{label: this.scopeName(this.rule.rotator_id), value: this.rule.rotator_id}] : []),
      ...this.rotators().map(rotator => ({label: rotator.name, value: rotator.id})),
    ];
  }
  metricIcon(metric: AlertMetric): string {
    return metric === 'usable_routes' ? 'icon-network' : metric === 'success_rate' ? 'icon-activity' : 'icon-clock';
  }
  channelIcon(channel: AlertChannel): string {
    switch (channel) {
      case 'email': return 'icon-mail';
      case 'slack': return 'icon-slack';
      case 'discord': return 'icon-discord';
      case 'webhook': return 'icon-code';
    }
  }
  measurementScope(rule: AlertRule): string {
    if (rule.metric === 'usable_routes') return 'Current routing eligibility';
    if (rule.rotator_id === null) return 'All attributed workspace checks, last 15 minutes';
    const protocol = this.rotators().find(r => r.id === rule.rotator_id)?.protocol.toUpperCase() ?? 'upstream';
    return `${protocol} TCP workspace checks, last 15 minutes`;
  }
  statusLabel(rule: AlertRule): string {
    if (rule.status === 'disabled') return 'Disabled';
    if (rule.status === 'unknown') return rule.active_incident_id ? 'Unknown, incident open' : 'Unknown';
    if (rule.active_incident_id) return rule.recovery_since ? 'Recovering' : 'Incident open';
    return rule.breach_since ? 'Pending breach' : 'Healthy';
  }
  statusTone(rule: AlertRule): string {
    if (rule.status === 'disabled') return 'neutral';
    if (rule.active_incident_id) return rule.recovery_since ? 'warning' : 'danger';
    if (rule.breach_since) return 'warning';
    return rule.status === 'healthy' ? 'healthy' : 'neutral';
  }
  unit(metric: AlertMetric): string { return metric === 'success_rate' ? '%' : metric === 'latency_ms' ? ' ms' : ''; }
  editRule(rule: AlertRule): void {
    if (!this.workspace.canOperate()) return;
    this.activeSection.set('rules');
    this.editingRuleId = rule.id;
    this.rule = {...rule, destination_ids: rule.destination_ids.filter(id => this.page().destinations.some(d => d.id === id))};
    this.focus('[name="ruleName"]');
  }
  cancelRule(): void { this.editingRuleId = null; this.rule = emptyRule(); }
  selectDestination(id: number, selected: boolean): void {
    this.rule.destination_ids = selected ? [...new Set([...this.rule.destination_ids, id])] : this.rule.destination_ids.filter(value => value !== id);
  }
  saveRule(): void {
    if (!this.workspace.canOperate() || !this.validThreshold() || this.rule.threshold === null || !this.rule.name.trim()) return;
    const payload: AlertRuleWrite = {...this.rule, name: this.rule.name.trim(), threshold: this.rule.threshold};
    this.mutate(this.api.saveRule(this.editingRuleId, payload), 'Alert rule saved.', () => this.cancelRule());
  }
  editDestination(destination: AlertDestination): void {
    if (!this.workspace.canAdminister()) return;
    this.activeSection.set('destinations');
    this.editingDestinationId = destination.id; this.destination = {...emptyDestination(), name: destination.name, kind: destination.kind, enabled: destination.enabled, mention_mode: destination.mention_mode ?? 'none', mention_id: destination.mention_id ?? ''};
    this.focus('[name="destinationName"]');
  }
  cancelDestination(): void { this.editingDestinationId = null; this.destination = emptyDestination(); }
  saveDestination(): void {
    if (!this.workspace.canAdminister() || !this.destination.name.trim() || !this.validMention()) return;
    const payload: AlertDestinationWrite = {name: this.destination.name.trim(), kind: this.destination.kind, enabled: this.destination.enabled};
    if (this.destination.target.trim()) payload.target = this.destination.target.trim();
    if (this.destination.kind === 'webhook' && (this.destination.signing_secret || this.destination.clear_signing_secret)) {
      payload.signing_secret = this.destination.clear_signing_secret ? '' : this.destination.signing_secret;
    }
    if (this.destination.kind === 'discord' || this.destination.kind === 'slack') {
      payload.mention_mode = this.destination.mention_mode;
      payload.mention_id = this.needsMentionId() ? this.destination.mention_id.trim() : '';
    }
    this.mutate(this.api.saveDestination(this.editingDestinationId, payload), 'Alert destination saved.', () => this.cancelDestination());
  }
  changeChannel(kind: AlertChannel): void {
    this.destination.kind = kind; this.destination.mention_mode = 'none'; this.destination.mention_id = '';
  }
  mentionOptions(): {value: AlertMentionMode; label: string}[] {
    const options: {value: AlertMentionMode; label: string}[] = [{value: 'none', label: 'No mention'}, {value: 'here', label: '@here'}, {value: 'everyone', label: '@everyone'}];
    return this.destination.kind === 'discord' ? [...options, {value: 'role', label: 'Role by ID'}]
      : [...options, {value: 'channel', label: '@channel'}, {value: 'user_group', label: 'User group by ID'}];
  }
  needsMentionId(): boolean { return this.destination.mention_mode === 'role' || this.destination.mention_mode === 'user_group'; }
  validMention(): boolean {
    const {kind, mention_mode: mode, mention_id: rawId} = this.destination;
    if (kind !== 'discord' && kind !== 'slack') return mode === 'none';
    if (!this.mentionOptions().some(option => option.value === mode)) return false;
    const id = rawId.trim();
    if (mode === 'role') return /^[1-9][0-9]{0,19}$/.test(id) && BigInt(id) <= 18446744073709551615n;
    if (mode === 'user_group') return /^S[A-Z0-9]{1,31}$/.test(id);
    return true;
  }
  mentionLabel(destination: AlertDestination): string {
    if (destination.mention_mode === 'role') return 'Role ' + destination.mention_id;
    if (destination.mention_mode === 'user_group') return 'User group ' + destination.mention_id;
    return destination.mention_mode && destination.mention_mode !== 'none' ? '@' + destination.mention_mode : '';
  }
  deleteConfirmed(): void {
    const item = this.confirmDelete();
    if (!item || (item.kind === 'rule' ? !this.workspace.canOperate() : !this.workspace.canAdminister())) return;
    this.mutate(item.kind === 'rule' ? this.api.deleteRule(item.id) : this.api.deleteDestination(item.id), 'Alert configuration deleted.', () => {
      this.confirmDelete.set(null);
      if (item.kind === 'rule' && this.editingRuleId === item.id) this.cancelRule();
      if (item.kind === 'destination') {
        if (this.editingDestinationId === item.id) this.cancelDestination();
        this.rule.destination_ids = this.rule.destination_ids.filter(id => id !== item.id);
      }
    });
  }
  requestDelete(kind: 'rule' | 'destination', id: number, name: string): void {
    this.confirmDelete.set({kind, id, name}); this.focus('.confirmation');
  }
  validThreshold(): boolean {
    const value = this.rule.threshold;
    if (value === null || !Number.isFinite(value)) return false;
    if (this.rule.metric === 'usable_routes') return Number.isInteger(value) && value >= 1 && value <= 1_000_000_000;
    if (this.rule.metric === 'latency_ms') return value > 0 && value <= 65535;
    return value >= 0 && value <= 100;
  }
  canRetry(delivery: AlertDelivery, incident: AlertIncident): boolean {
    return delivery.status === 'failed' && this.workspace.canAdminister() && incident.close_reason !== 'configuration_changed'
      && this.page().rules.some(r => r.id === incident.rule_id && r.revision === incident.rule_revision)
      && this.page().destinations.some(d => d.id === delivery.destination_id && d.enabled)
      && !this.page().deliveries.some(d => d.incident_id === delivery.incident_id && d.destination_id === delivery.destination_id && d.id > delivery.id);
  }
  private focus(selector: string): void {
    afterNextRender(() => {
      const element = this.host.nativeElement.querySelector<HTMLElement>(selector);
      element?.scrollIntoView({behavior: 'smooth', block: 'center'}); element?.focus({preventScroll: true});
    }, {injector: this.injector});
  }
  retryDelivery(id: number): void {
    if (this.workspace.canAdminister()) this.mutate(this.api.retryDelivery(id), 'Notification queued for retry.');
  }
  private mutate<T>(request: Observable<T>, message: string, done: () => void = () => {}): void {
    if (this.busy()) return;
    const workspaceId = this.workspace.current()?.id;
    const version = ++this.actionVersion;
    this.busy.set(true); this.error.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (workspaceId !== this.workspace.current()?.id || version !== this.actionVersion) return;
        this.busy.set(false); done(); this.notification.showSuccess(message); this.load(this.cursor);
      },
      error: err => {
        if (workspaceId !== this.workspace.current()?.id || version !== this.actionVersion) return;
        this.busy.set(false); this.error.set(this.errorMessage(err));
      },
    });
  }
  private errorMessage(err: unknown): string {
    const response = err as {error?: {error?: string; message?: string}};
    return response?.error?.error ?? response?.error?.message ?? 'Could not load or save alerts. Try again.';
  }
}
