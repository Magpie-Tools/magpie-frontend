import {CommonModule} from '@angular/common';
import {Component, computed, DestroyRef, effect, inject, signal, untracked} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
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
import {NotificationFocusService, parseNotificationTargetId} from '../shared/notification-focus.service';
import {PageLoadErrorComponent} from '../shared/page-load-error/page-load-error.component';
import {DialogComponent} from '../shared/ui/dialog.component';
import {TooltipComponent} from '../tooltip/tooltip.component';

const emptyPage = (): AlertsPage => ({rules: [], destinations: [], incidents: [], deliveries: [], next_cursor: 0});
const emptyRule = () => ({name: '', rotator_id: null as number | null, metric: 'usable_routes' as AlertMetric, threshold: null as number | null, enabled: true, destination_ids: [] as number[]});
const nameLimitBytes = 120;
const encoder = new TextEncoder();
/** Trims a generated name to the backend's byte limit without splitting a character. */
const clampBytes = (value: string, limit: number): string => {
  const characters = Array.from(value);
  while (encoder.encode(characters.join('')).length > limit) characters.pop();
  return characters.join('').trimEnd();
};
const emptyDestination = () => ({name: '', kind: 'email' as AlertChannel, enabled: true, target: '', signing_secret: '', clear_signing_secret: false, mention_mode: 'none' as AlertMentionMode, mention_id: ''});

@Component({
  selector: 'app-alerts', standalone: true,
  providers: [NotificationFocusService],
  imports: [CommonModule, FormsModule, BrnHoverCardImports, HlmInput, HlmSkeleton, HlmTabsImports, SelectComponent, PageLoadErrorComponent, DialogComponent, TooltipComponent],
  templateUrl: './alerts.component.html', styleUrls: ['./alerts.component.scss', './alerts-incidents.component.scss', './alerts-dialogs.component.scss'],
})
export class AlertsComponent {
  private readonly notificationFocus = inject(NotificationFocusService);
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
  readonly highlightedIncidentId = this.notificationFocus.highlightedId;
  readonly openIncidentCount = computed(() => new Set(this.page().rules.flatMap(rule => rule.active_incident_id ? [rule.active_incident_id] : [])).size);
  readonly destinationsById = computed(() => new Map(this.page().destinations.map(destination => [destination.id, destination])));
  readonly sections = [
    {id: 'rules', label: 'Alert rules', icon: 'icon-sliders-horizontal'},
    {id: 'destinations', label: 'Destinations', icon: 'icon-send'},
    {id: 'history', label: 'Incident history', icon: 'icon-history'},
  ];
  readonly confirmDelete = signal<{kind: 'rule' | 'destination'; id: number; name: string} | null>(null);
  readonly ruleDialogOpen = signal(false);
  readonly destinationDialogOpen = signal(false);
  /** Save and delete failures, shown inside the dialog that caused them. */
  readonly formError = signal('');
  readonly metrics: {value: AlertMetric; label: string; description: string; icon: string}[] = [
    {value: 'usable_routes', label: 'Usable routes', description: 'Too few routes can serve traffic', icon: 'icon-network'},
    {value: 'success_rate', label: 'Success rate', description: 'Too many proxy checks fail', icon: 'icon-activity'},
    {value: 'latency_ms', label: 'Latency', description: 'Successful checks get slow', icon: 'icon-clock'},
  ];
  readonly channels: {value: AlertChannel; label: string; description: string}[] = [
    {value: 'email', label: 'Email', description: 'Send to an inbox'},
    {value: 'slack', label: 'Slack', description: 'Post to a channel'},
    {value: 'discord', label: 'Discord', description: 'Post to a channel'},
    {value: 'webhook', label: 'Webhook', description: 'POST JSON to a URL'},
  ];
  targetTouched = false;
  revealTarget = false;
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
  private requestedIncidentId: number | null = null;
  private requestedIncidentWorkspaceId?: number;
  /** The rule dialog was set aside to create a destination and reopens afterwards. */
  private resumeRuleDialog = false;

  constructor(private readonly api: AlertsService, public readonly workspace: WorkspaceService,
              private readonly notification: NotificationService, private readonly destroyRef: DestroyRef,
              private readonly route: ActivatedRoute, private readonly router: Router) {
    effect(() => {
      const workspaceId = workspace.current()?.id;
      untracked(() => {
        this.notificationFocus.clear();
        this.pageRequest?.unsubscribe(); this.rotatorsRequest?.unsubscribe();
        this.requestVersion++; this.rotatorsVersion++; this.actionVersion++; this.page.set(emptyPage()); this.rotators.set([]);
        this.rotatorsLoading.set(false); this.rotatorsLoaded.set(false); this.rotatorsError.set(false);
        this.loading.set(!!workspaceId);
        this.loaded.set(false); this.busy.set(false); this.error.set(''); this.cursor = 0;
        this.activeSection.set(this.requestedIncidentId ? 'history' : this.sectionFromRoute(this.route.snapshot.queryParamMap.get('section')));
        this.resumeRuleDialog = false; this.cancelRule(); this.cancelDestination(); this.confirmDelete.set(null); this.formError.set('');
        if (workspaceId) { this.load(); this.loadRotators(); }
      });
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe(params => {
      const id = parseNotificationTargetId(params.get('incident'));
      this.requestedIncidentId = id;
      this.notificationFocus.cancelPending();
      this.activeSection.set(this.requestedIncidentId ? 'history' : this.sectionFromRoute(params.get('section')));
      if (this.requestedIncidentId) {
        this.notificationFocus.clear();
        this.requestedIncidentWorkspaceId = this.workspace.current()?.id;
        if (this.cursor || (this.loaded() && !this.loading() && !this.page().incidents.some(incident => incident.id === id))) {
          this.load();
        } else {
          this.focusRequestedIncident();
        }
      } else if (this.activeSection() !== 'history') {
        this.notificationFocus.clear();
      }
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
        this.focusRequestedIncident();
      },
      error: err => {
        if (version !== this.requestVersion || workspaceId !== this.workspace.current()?.id) return;
        const message = this.loaded()
          ? 'Could not refresh alerts. Showing the last loaded alert rules and incident history.'
          : 'Alert rules and incident history are unavailable.';
        this.error.set(`${message} ${this.errorMessage(err, 'Check the backend connection and try again.')}`);
        this.loading.set(false);
      },
    });
  }
  refresh(): void { this.load(); this.loadRotators(); }
  selectSection(tab: string): void {
    const section = this.sections.find(section => 'alerts-' + section.id === tab);
    if (section) {
      this.activeSection.set(section.id);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {section: section.id === 'rules' ? null : section.id, incident: null},
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }
  private sectionFromRoute(section: string | null): string {
    return this.sections.some(candidate => candidate.id === section) ? section! : 'rules';
  }
  private focusRequestedIncident(): void {
    const id = this.requestedIncidentId;
    if (!id || !this.loaded() || this.loading() || this.error() || this.activeSection() !== 'history') return;
    const workspaceId = this.workspace.current()?.id;
    if (this.requestedIncidentWorkspaceId !== undefined && this.requestedIncidentWorkspaceId !== workspaceId) {
      this.consumeIncidentLink(id);
      return;
    }
    const version = this.requestVersion;
    this.notificationFocus.schedule({
      id,
      selector: `#alert-incident-${id}`,
      isCurrent: () => this.requestedIncidentId === id && this.requestVersion === version && this.workspace.current()?.id === workspaceId && this.activeSection() === 'history',
      onMissing: () => {
        const next = this.page().next_cursor;
        // The exclusive history cursor can jump straight to this incident.
        if (next && id < next && this.cursor !== id + 1) this.load(id + 1);
        else this.consumeIncidentLink(id);
      },
      onFocused: () => this.consumeIncidentLink(id),
    });
  }
  private consumeIncidentLink(id: number): void {
    // Let another click on the same notification replay the highlight.
    this.requestedIncidentId = null;
    if (this.route.snapshot.queryParamMap.get('incident') === String(id)) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {section: 'history', incident: null},
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
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
  newRule(): void {
    if (!this.workspace.canOperate()) return;
    this.cancelRule();
    this.formError.set(''); this.ruleDialogOpen.set(true);
  }
  editRule(rule: AlertRule): void {
    if (!this.workspace.canOperate()) return;
    this.activeSection.set('rules');
    this.editingRuleId = rule.id;
    this.rule = {...rule, destination_ids: rule.destination_ids.filter(id => this.page().destinations.some(d => d.id === id))};
    this.formError.set(''); this.ruleDialogOpen.set(true);
  }
  cancelRule(): void { this.editingRuleId = null; this.rule = emptyRule(); this.ruleDialogOpen.set(false); }
  /** Escape and the close button discard the draft. Programmatic closes have already handled it. */
  ruleDialogVisibilityChanged(visible: boolean): void {
    if (!visible && this.ruleDialogOpen()) this.cancelRule();
  }
  changeMetric(metric: AlertMetric): void {
    if (this.rule.metric === metric) return;
    this.rule.metric = metric; this.rule.threshold = null;
  }
  metricOption(metric: AlertMetric) { return this.metrics.find(option => option.value === metric)!; }
  thresholdLead(metric: AlertMetric): string {
    return metric === 'usable_routes' ? 'Alert when usable routes drop below'
      : metric === 'success_rate' ? 'Alert when the success rate drops below' : 'Alert when average latency rises above';
  }
  thresholdUnit(metric: AlertMetric): string { return metric === 'success_rate' ? '%' : metric === 'latency_ms' ? 'ms' : 'routes'; }
  thresholdPlaceholder(metric: AlertMetric): string { return metric === 'success_rate' ? '80' : metric === 'latency_ms' ? '1500' : '50'; }
  thresholdError(): string {
    if (this.rule.threshold === null || this.validThreshold()) return '';
    if (this.rule.metric === 'usable_routes') return 'Enter a whole number from 1 to 1,000,000,000.';
    if (this.rule.metric === 'latency_ms') return 'Enter a value above 0 and up to 65,535 ms.';
    return 'Enter a percentage from 0 to 100.';
  }
  draftScopeHint(): string {
    if (this.rule.metric === 'usable_routes') {
      return this.rule.rotator_id === null ? 'Counts routes that are currently eligible for routing.' : "Counts routes that pass this rotator's filters.";
    }
    return this.rule.rotator_id === null ? 'Measures all workspace checks over the last 15 minutes.'
      : "Measures workspace checks for this rotator's upstream protocol over the last 15 minutes.";
  }
  /** Used as the rule name when the name field is left blank. */
  suggestedRuleName(): string {
    if (!this.validThreshold() || this.rule.threshold === null) return '';
    const unit = this.rule.metric === 'usable_routes' ? '' : this.unit(this.rule.metric);
    const comparison = this.rule.metric === 'latency_ms' ? 'above' : 'below';
    const name = `${this.metricOption(this.rule.metric).label} ${comparison} ${this.rule.threshold}${unit} · ${this.scopeName(this.rule.rotator_id)}`;
    return clampBytes(name, nameLimitBytes);
  }
  ruleName(): string { return this.rule.name.trim() || this.suggestedRuleName(); }
  canSaveRule(): boolean { return this.workspace.canOperate() && !this.busy() && this.validThreshold() && !!this.ruleName(); }
  selectDestination(id: number, selected: boolean): void {
    this.rule.destination_ids = selected ? [...new Set([...this.rule.destination_ids, id])] : this.rule.destination_ids.filter(value => value !== id);
  }
  saveRule(): void {
    const name = this.ruleName();
    if (!this.workspace.canOperate() || !this.validThreshold() || this.rule.threshold === null || !name) return;
    const payload: AlertRuleWrite = {...this.rule, name, threshold: this.rule.threshold};
    const created = this.editingRuleId === null;
    this.mutate(this.api.saveRule(this.editingRuleId, payload), created ? 'Alert rule created.' : 'Alert rule saved.', () => this.cancelRule());
  }
  newDestination(): void {
    if (!this.workspace.canAdminister()) return;
    this.editingDestinationId = null; this.destination = emptyDestination(); this.targetTouched = false; this.revealTarget = false;
    this.formError.set(''); this.destinationDialogOpen.set(true);
  }
  /** Sets the rule draft aside, creates a destination, then returns with it selected. */
  newDestinationFromRule(): void {
    if (!this.workspace.canAdminister() || !this.ruleDialogOpen()) return;
    this.resumeRuleDialog = true;
    this.ruleDialogOpen.set(false);
    this.newDestination();
  }
  resumesRule(): boolean { return this.resumeRuleDialog; }
  editDestination(destination: AlertDestination): void {
    if (!this.workspace.canAdminister()) return;
    this.activeSection.set('destinations');
    this.editingDestinationId = destination.id; this.destination = {...emptyDestination(), name: destination.name, kind: destination.kind, enabled: destination.enabled, mention_mode: destination.mention_mode ?? 'none', mention_id: destination.mention_id ?? ''};
    this.targetTouched = false; this.revealTarget = false;
    this.formError.set(''); this.destinationDialogOpen.set(true);
  }
  cancelDestination(): void {
    this.editingDestinationId = null; this.destination = emptyDestination(); this.targetTouched = false;
    this.destinationDialogOpen.set(false);
    if (this.resumeRuleDialog) {
      this.resumeRuleDialog = false;
      this.formError.set(''); this.ruleDialogOpen.set(true);
    }
  }
  destinationDialogVisibilityChanged(visible: boolean): void {
    if (!visible && this.destinationDialogOpen()) this.cancelDestination();
  }
  targetLabel(kind: AlertChannel): string {
    switch (kind) {
      case 'email': return 'Email address';
      case 'slack': return 'Slack incoming webhook URL';
      case 'discord': return 'Discord webhook URL';
      case 'webhook': return 'Endpoint URL';
    }
  }
  targetPlaceholder(kind: AlertChannel): string {
    switch (kind) {
      case 'email': return 'ops@example.com';
      case 'slack': return 'https://hooks.slack.com/services/…';
      case 'discord': return 'https://discord.com/api/webhooks/…';
      case 'webhook': return 'https://alerts.example.com/magpie';
    }
  }
  targetHint(kind: AlertChannel): string {
    switch (kind) {
      case 'email': return 'Email delivery requires SMTP to be configured on the server.';
      case 'slack': return 'In Slack, add the Incoming Webhooks app to a channel and copy its webhook URL.';
      case 'discord': return 'In Discord, open Channel settings → Integrations → Webhooks and copy the webhook URL.';
      case 'webhook': return 'Magpie sends a JSON POST request when an incident opens and when it recovers.';
    }
  }
  /** Mirrors the server's checks so mistakes show before saving. The server still validates. */
  targetError(): string {
    const target = this.destination.target.trim();
    if (!target) return this.editingDestinationId === null ? 'Required.' : '';
    if (target.length > 4096) return 'Must be at most 4,096 characters.';
    if (this.destination.kind === 'email') {
      return /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/.test(target) && target.length <= 254 ? '' : 'Enter one email address, like ops@example.com.';
    }
    let url: URL;
    try { url = new URL(target); } catch { return 'Enter a full URL starting with https://.'; }
    if (url.hash) return 'Remove the # fragment from the URL.';
    const host = url.hostname.toLowerCase();
    if (this.destination.kind === 'slack' && (url.protocol !== 'https:' || url.port || !['hooks.slack.com', 'hooks.slack-gov.com'].includes(host) || !url.pathname.startsWith('/services/'))) {
      return 'Use a Slack incoming webhook URL that starts with https://hooks.slack.com/services/.';
    }
    if (this.destination.kind === 'discord' && (url.protocol !== 'https:' || url.port || host !== 'discord.com' || !url.pathname.startsWith('/api/webhooks/'))) {
      return 'Use a Discord webhook URL that starts with https://discord.com/api/webhooks/.';
    }
    if (this.destination.kind === 'webhook' && url.protocol !== 'https:' && url.protocol !== 'http:') return 'Use an https:// URL.';
    return '';
  }
  /** Used as the destination name when the name field is left blank. */
  suggestedDestinationName(): string {
    const target = this.destination.target.trim();
    const valid = !!target && !this.targetError();
    switch (this.destination.kind) {
      case 'email': return valid ? clampBytes(target, nameLimitBytes) : 'Email';
      case 'slack': return 'Slack channel';
      case 'discord': return 'Discord channel';
      case 'webhook': return valid ? clampBytes(`Webhook · ${new URL(target).hostname}`, nameLimitBytes) : 'Webhook';
    }
  }
  destinationName(): string { return this.destination.name.trim() || this.suggestedDestinationName(); }
  canSaveDestination(): boolean {
    return this.workspace.canAdminister() && !this.busy() && !this.targetError() && this.validMention() && !!this.destinationName();
  }
  saveDestination(): void {
    if (!this.workspace.canAdminister() || !this.destinationName() || !this.validMention() || this.targetError()) return;
    const payload: AlertDestinationWrite = {name: this.destinationName(), kind: this.destination.kind, enabled: this.destination.enabled};
    if (this.destination.target.trim()) payload.target = this.destination.target.trim();
    if (this.destination.kind === 'webhook' && (this.destination.signing_secret || this.destination.clear_signing_secret)) {
      payload.signing_secret = this.destination.clear_signing_secret ? '' : this.destination.signing_secret;
    }
    if (this.destination.kind === 'discord' || this.destination.kind === 'slack') {
      payload.mention_mode = this.destination.mention_mode;
      payload.mention_id = this.needsMentionId() ? this.destination.mention_id.trim() : '';
    }
    const created = this.editingDestinationId === null;
    this.mutate(this.api.saveDestination(this.editingDestinationId, payload), created ? 'Alert destination created.' : 'Alert destination saved.', saved => {
      if (created && this.resumeRuleDialog && saved?.id) this.rule.destination_ids = [...new Set([...this.rule.destination_ids, saved.id])];
      this.cancelDestination();
    });
  }
  changeChannel(kind: AlertChannel): void {
    if (this.editingDestinationId !== null) return;
    this.destination.kind = kind; this.destination.mention_mode = 'none'; this.destination.mention_id = '';
    this.destination.signing_secret = ''; this.targetTouched = false;
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
    this.formError.set(''); this.confirmDelete.set({kind, id, name});
  }
  /** Rules that would stop notifying anyone if this destination were deleted. */
  rulesUsingDestination(id: number): AlertRule[] { return this.page().rules.filter(rule => rule.destination_ids.includes(id)); }
  ruleNamesUsingDestination(id: number): string { return this.rulesUsingDestination(id).map(rule => rule.name).join(', '); }
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
  retryDelivery(id: number): void {
    if (this.workspace.canAdminister()) this.mutate(this.api.retryDelivery(id), 'Notification queued for retry.', () => {}, this.error);
  }
  /** Failures go to `errorTarget`: the open dialog's notice by default, or the page notice. */
  private mutate<T>(request: Observable<T>, message: string, done: (result: T) => void = () => {}, errorTarget = this.formError): void {
    if (this.busy()) return;
    const workspaceId = this.workspace.current()?.id;
    const version = ++this.actionVersion;
    this.busy.set(true); errorTarget.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        if (workspaceId !== this.workspace.current()?.id || version !== this.actionVersion) return;
        this.busy.set(false); done(result); this.notification.showSuccess(message); this.load(this.cursor);
      },
      error: err => {
        if (workspaceId !== this.workspace.current()?.id || version !== this.actionVersion) return;
        this.busy.set(false); errorTarget.set(this.errorMessage(err));
      },
    });
  }
  private errorMessage(err: unknown, fallback = 'Could not load or save alerts. Try again.'): string {
    const response = err as {error?: {error?: string; message?: string}};
    return response?.error?.error || response?.error?.message || fallback;
  }
}
