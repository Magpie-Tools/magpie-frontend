import {HlmSkeleton} from '@spartan-ng/helm/skeleton';
import {HlmTabs, HlmTabsList, HlmTabsTrigger, HlmTabsContent} from '@spartan-ng/helm/tabs';
import {DialogComponent} from '../shared/ui/dialog.component';
import {CommonModule, DatePipe, DecimalPipe, TitleCasePipe} from '@angular/common';
import {Component, DestroyRef, LOCALE_ID, OnInit, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {interval} from 'rxjs';
import {FormsModule} from '@angular/forms';

import {finalize, switchMap} from 'rxjs/operators';
import {
  WorkspaceInvitation,
  WorkspaceInvitationResponse,
  WorkspaceInvitationWriteRequest,
  WorkspaceMember,
  WorkspaceMemberWriteRequest,
  WorkspaceRole,
  ROLE_DESCRIPTIONS,
} from '../models/Workspace';
import {HttpService} from '../services/http.service';
import {NotificationService} from '../services/notification-service.service';
import {WorkspaceService} from '../services/workspace.service';
import {UserService} from '../services/authorization/user.service';
import {formatApproximateDuration} from '../shared/cadence-format';
import {VisibleRowsDirective} from '../shared/visible-rows.directive';
import {AllowanceForecastChartComponent, ForecastSeries} from './allowance-forecast-chart.component';

type WorkspaceSection = 'overview' | 'members' | 'settings';

/**
 * How long workspace data, including metered allowance usage, may be shown
 * before the page reloads it. The backend recomputes cadence every minute.
 */
export const WORKSPACE_USAGE_MAX_AGE_MS = 60_000;

type InvitationRole = WorkspaceInvitation['role'];

export type CadenceKind = 'checks' | 'scrapes';
export type CadenceUnit = 'minutes' | 'hours' | 'days';

export interface CadenceDraft {
  mode: 'automatic' | 'fixed';
  value: number;
  unit: CadenceUnit;
}

const cadenceUnitSeconds: Record<CadenceUnit, number> = {minutes: 60, hours: 3600, days: 86400};

/** Picks the largest unit that expresses a stored interval exactly. */
export function cadenceDraftFromSeconds(seconds: number): CadenceDraft {
  if (!seconds) {
    return {mode: 'automatic', value: 1, unit: 'hours'};
  }
  for (const unit of ['days', 'hours', 'minutes'] as CadenceUnit[]) {
    if (seconds % cadenceUnitSeconds[unit] === 0) {
      return {mode: 'fixed', value: seconds / cadenceUnitSeconds[unit], unit};
    }
  }
  return {mode: 'fixed', value: Math.max(1, Math.round(seconds / 60)), unit: 'minutes'};
}

export interface AllowanceMeter {
  id: 'checks' | 'scrapes';
  label: string;
  unit: string;
  used: number;
  monthly: number;
  percent: number;
  inherits: boolean;
  exhausted: boolean;
  /** No monthly limit: no progress bar, and a fixed interval is required. */
  unlimited: boolean;
  cadence: string;
  /** Set when a fixed interval uses up the allowance before the month ends. */
  runOutWarning: string | null;
  /** Short schedule summary, such as "Automatic · every 14 minutes". */
  schedule: string;
  /** What happens by the end of the period, such as "Lasts the month". */
  outlook: string;
  outlookTone: 'ok' | 'warn' | 'stopped' | 'neutral';
  /** Line colour on the allowance chart. */
  color: string;
  /** No monthly limit and no fixed interval yet. */
  needsInterval: boolean;
}

/** Categorical colours for the allowance chart, validated for colour-vision deficiencies on the dark card. */
export const ALLOWANCE_SERIES_COLORS: Record<CadenceKind, string> = {checks: '#22a37a', scrapes: '#8f7ae0'};

const DAY_MS = 86_400_000;

export interface RouteBar {
  active: number;
  available: number;
  paused: number;
  activeWidth: number;
  availableWidth: number;
  pausedWidth: number;
  /** Position of the activation limit along the bar, in percent. */
  limitAt: number;
}

/** What the access panel shows: a member, a pending invitation, or a new invitation. */
export type AccessPanel =
  | {kind: 'member'; userId: number}
  | {kind: 'invitation'; id: number}
  | {kind: 'invite'};

interface OwnershipChange {
  member: WorkspaceMember;
  role: WorkspaceRole;
}

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [HlmSkeleton, HlmTabs, HlmTabsList, HlmTabsTrigger, HlmTabsContent, DialogComponent,
    VisibleRowsDirective,
    AllowanceForecastChartComponent,
    CommonModule,
    FormsModule,
    DatePipe,
    DecimalPipe,
    TitleCasePipe,

  ],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.scss',
})
export class WorkspaceComponent implements OnInit {
  readonly members = signal<WorkspaceMember[]>([]);
  readonly invitations = signal<WorkspaceInvitation[]>([]);
  readonly loadingMembers = signal(false);
  readonly loadingInvitations = signal(false);
  readonly membersError = signal<string | null>(null);
  readonly invitationsError = signal<string | null>(null);
  readonly workspaceError = signal<string | null>(null);
  readonly inviteError = signal<string | null>(null);
  readonly savingWorkspace = signal(false);
  readonly creatingWorkspace = signal(false);
  readonly sendingInvitation = signal(false);
  readonly savingMemberIds = signal<Record<number, boolean>>({});
  readonly savingInvitationIds = signal<Record<number, boolean>>({});
  readonly activeSection = signal<WorkspaceSection>('overview');
  readonly sections: readonly {id: WorkspaceSection; label: string; icon: string}[] = [
    {id: 'overview', label: 'Overview', icon: 'icon-layout-grid'},
    {id: 'members', label: 'Members', icon: 'icon-users'},
    {id: 'settings', label: 'Settings', icon: 'icon-settings'},
  ];
  readonly createExpanded = signal(false);
  readonly memberSearch = signal('');
  readonly removalTarget = signal<WorkspaceMember | null>(null);
  readonly revokeTarget = signal<WorkspaceInvitation | null>(null);
  readonly ownershipChange = signal<OwnershipChange | null>(null);
  readonly removingMember = signal(false);
  readonly revokingInvitation = signal(false);
  readonly savingAllowances = signal(false);
  readonly isInstanceAdmin = UserService.isAdmin();
  readonly savingCadence = signal(false);
  readonly scheduleOpen = signal(false);
  readonly accessPanel = signal<AccessPanel | null>(null);
  /** Re-creates the role picker so it shows the saved role after an ownership change is cancelled. */
  readonly rolePickerRevision = signal(0);
  readonly roleDescriptions = ROLE_DESCRIPTIONS;
  readonly cadenceUnits: CadenceUnit[] = ['minutes', 'hours', 'days'];
  cadenceDrafts: Record<CadenceKind, CadenceDraft> = {
    checks: cadenceDraftFromSeconds(0),
    scrapes: cadenceDraftFromSeconds(0),
  };
  allowanceChecks: number | null = null;
  allowanceScrapes: number | null = null;
  allowanceUnlimitedChecks = false;
  allowanceUnlimitedScrapes = false;

  readonly allowanceMeters = computed<AllowanceMeter[]>(() => {
    const allowances = this.workspaces.current()?.allowances;
    if (!allowances) {
      return [];
    }
    const resumes = new Date(allowances.period_end).toLocaleDateString(undefined, {dateStyle: 'medium'});
    const meter = (
      id: AllowanceMeter['id'], label: string, unit: string, used: number, monthly: number,
      inherits: boolean, exhausted: boolean, intervalSeconds: number, perCycle: number,
      plural: string, singular: string, verb: string,
    ): AllowanceMeter => {
      let cadence: string;
      const fixed = id === 'checks'
        ? allowances.requested_check_interval_seconds > 0
        : allowances.requested_scrape_interval_seconds > 0;
      const unlimited = id === 'checks' ? allowances.unlimited_checks : allowances.unlimited_scrapes;
      const needsInterval = id === 'checks' ? allowances.needs_check_interval : allowances.needs_scrape_interval;
      if (needsInterval) {
        cadence = `No monthly limit. Until you choose an interval, each ${singular} is ${verb} every hour.`;
      } else if (exhausted) {
        cadence = `Allowance used. ${label} resume on ${resumes}.`;
      } else if (!allowances.computed_at) {
        cadence = 'Cadence is calculated within a minute.';
      } else if (perCycle === 0) {
        cadence = `No active ${plural} yet.`;
      } else {
        cadence = `${fixed ? 'Fixed interval: each' : 'Each'} ${singular} is ${verb} ${formatApproximateDuration(intervalSeconds)}.`;
      }
      const runOut = id === 'checks' ? allowances.checks_run_out_at : allowances.scrapes_run_out_at;
      const runOutWarning = !exhausted && runOut
        ? `At this interval the allowance runs out around ${new Date(runOut).toLocaleDateString(undefined, {dateStyle: 'medium'})}, and ${label.toLowerCase()} stop until next month.`
        : null;
      const mode = fixed ? 'Fixed' : 'Automatic';
      const schedule = needsInterval
        ? 'No interval chosen · hourly for now'
        : perCycle === 0 ? `${mode} · no active ${plural}`
          : intervalSeconds > 0 ? `${mode} · ${formatApproximateDuration(intervalSeconds)}` : mode;
      const shortDate = (value: string) => new Date(value).toLocaleDateString(this.locale, {month: 'short', day: 'numeric'});
      let outlook = 'Lasts the month';
      let outlookTone: AllowanceMeter['outlookTone'] = 'ok';
      if (unlimited) {
        outlook = 'No monthly limit';
        outlookTone = 'neutral';
      } else if (exhausted) {
        outlook = `Used up · resumes ${shortDate(allowances.period_end)}`;
        outlookTone = 'stopped';
      } else if (runOut) {
        outlook = `Runs out ${shortDate(runOut)}`;
        outlookTone = 'warn';
      }
      return {
        id, label, unit, used, monthly, inherits, exhausted, unlimited, cadence,
        schedule, outlook, outlookTone, color: ALLOWANCE_SERIES_COLORS[id], needsInterval,
        runOutWarning: unlimited ? null : runOutWarning,
        percent: unlimited ? 0 : monthly > 0 ? Math.min(100, Math.round((used / monthly) * 100)) : 100,
      };
    };
    return [
      meter('checks', 'Checks', 'checks', allowances.used_checks, allowances.monthly_checks,
        allowances.inherits_checks, allowances.checks_exhausted, allowances.check_interval_seconds,
        allowances.checks_per_cycle, 'proxies', 'proxy', 'checked'),
      meter('scrapes', 'Scrapes', 'scrapes', allowances.used_scrapes, allowances.monthly_scrapes,
        allowances.inherits_scrapes, allowances.scrapes_exhausted, allowances.scrape_interval_seconds,
        allowances.scrapes_per_cycle, 'sources', 'source', 'scraped'),
    ];
  });

  /** Allowance use and its projection for every metric that has a monthly limit. */
  readonly forecast = computed(() => {
    const allowances = this.workspaces.current()?.allowances;
    if (!allowances) {
      return null;
    }
    const start = Date.parse(allowances.period_start);
    const end = Date.parse(allowances.period_end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return null;
    }
    const now = Math.min(Math.max(Date.now(), start), end);
    const series = this.allowanceMeters()
      .filter(meter => !meter.unlimited && meter.monthly > 0)
      .map(meter => this.forecastSeries(meter, start, end, now));
    return {start, end, now, series};
  });

  readonly periodDaysLeft = computed(() => {
    const forecast = this.forecast();
    return forecast ? Math.max(0, Math.ceil((forecast.end - forecast.now) / DAY_MS)) : 0;
  });

  readonly periodElapsedPercent = computed(() => {
    const forecast = this.forecast();
    return forecast ? Math.round(((forecast.now - forecast.start) / (forecast.end - forecast.start)) * 100) : 0;
  });

  /** Active, still available and paused routes on one bar, with the activation limit marked. */
  readonly routeBar = computed<RouteBar | null>(() => {
    const capacity = this.workspaces.current()?.capacity;
    if (!capacity || capacity.activation_limit === null) {
      return null;
    }
    const active = capacity.active_routes;
    const available = Math.max(0, capacity.activation_limit - active);
    const paused = Math.max(0, capacity.stored_routes - active);
    const total = Math.max(1, active + available + paused);
    return {
      active,
      available,
      paused,
      activeWidth: (active / total) * 100,
      availableWidth: (available / total) * 100,
      pausedWidth: (paused / total) * 100,
      limitAt: ((Math.max(active, capacity.activation_limit)) / total) * 100,
    };
  });

  readonly panelMember = computed(() => {
    const panel = this.accessPanel();
    return panel?.kind === 'member' ? this.members().find(member => member.user_id === panel.userId) ?? null : null;
  });

  readonly panelInvitation = computed(() => {
    const panel = this.accessPanel();
    return panel?.kind === 'invitation' ? this.invitations().find(invitation => invitation.id === panel.id) ?? null : null;
  });

  readonly ownerCount = computed(() => this.members().filter(member => member.role === 'owner').length);

  workspaceName = '';
  newWorkspaceName = '';
  inviteEmail = '';
  inviteRole: InvitationRole = 'operator';
  inviteBillingAdmin = false;
  memberEdits: Record<number, WorkspaceMemberWriteRequest> = {};
  invitationEdits: Record<number, WorkspaceInvitationWriteRequest> = {};

  readonly ownerMemberRoles: WorkspaceRole[] = ['owner', 'admin', 'operator', 'viewer'];
  readonly ownerInvitationRoles: InvitationRole[] = ['admin', 'operator', 'viewer'];
  readonly adminRoles: InvitationRole[] = ['operator', 'viewer'];

  constructor(
    readonly workspaces: WorkspaceService,
    private readonly http: HttpService,
    private readonly notification: NotificationService,
  ) {}

  private readonly destroyRef = inject(DestroyRef);
  private readonly user = inject(UserService);
  /** The app locale, so dates built in code match the date pipe. */
  readonly locale = inject(LOCALE_ID);

  ngOnInit(): void {
    this.loadWorkspace();
    // Usage and cadence change while the page is open. Reload them in the
    // background without resetting drafts the user is editing.
    interval(WORKSPACE_USAGE_MAX_AGE_MS).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      this.workspaces.load(false, WORKSPACE_USAGE_MAX_AGE_MS).subscribe({error: () => undefined});
    });
  }

  loadWorkspace(force = false): void {
    this.workspaceError.set(null);
    this.workspaces.load(force, WORKSPACE_USAGE_MAX_AGE_MS).subscribe({
      next: () => this.syncCurrentWorkspace(),
      error: error => this.workspaceError.set(this.errorMessage(error)),
    });
  }

  syncCurrentWorkspace(): void {
    const current = this.workspaces.current();
    if (!current) {
      this.workspaceName = '';
      this.members.set([]);
      this.invitations.set([]);
      return;
    }
    this.workspaceName = current.name;
    this.resetCadenceDrafts();
    this.allowanceChecks = current.subscription.monthly_checks || null;
    this.allowanceScrapes = current.subscription.monthly_scrapes || null;
    this.allowanceUnlimitedChecks = current.subscription.unlimited_checks ?? false;
    this.allowanceUnlimitedScrapes = current.subscription.unlimited_scrapes ?? false;
    this.loadMembers();
    if (this.workspaces.canAdminister()) {
      this.loadInvitations();
    } else {
      this.invitations.set([]);
      this.invitationsError.set(null);
    }
  }

  /** Sets the interval editor back to the saved intervals. */
  resetCadenceDrafts(): void {
    const allowances = this.workspaces.current()?.allowances;
    this.cadenceDrafts = {
      checks: cadenceDraftFromSeconds(allowances?.requested_check_interval_seconds ?? 0),
      scrapes: cadenceDraftFromSeconds(allowances?.requested_scrape_interval_seconds ?? 0),
    };
    // Without a monthly limit there is nothing to spread, so the editor starts
    // on the hourly interval the workspace already runs at and offers to save it.
    for (const kind of ['checks', 'scrapes'] as CadenceKind[]) {
      if (this.isUnlimited(kind) && this.cadenceDrafts[kind].mode === 'automatic') {
        this.cadenceDrafts[kind] = {mode: 'fixed', value: 1, unit: 'hours'};
      }
    }
  }

  openSchedule(): void {
    this.resetCadenceDrafts();
    this.scheduleOpen.set(true);
  }

  closeSchedule(): void {
    if (this.savingCadence() || this.savingAllowances()) {
      return;
    }
    this.scheduleOpen.set(false);
    this.resetCadenceDrafts();
  }

  /** Large counts in short form, such as 1.82M. */
  compactNumber(value: number): string {
    return value >= 100_000
      ? new Intl.NumberFormat(undefined, {notation: 'compact', maximumFractionDigits: 2}).format(value)
      : value.toLocaleString();
  }

  /** Opens the invitation panel on Members. */
  startInvite(): void {
    if (!this.workspaces.canAdminister()) {
      return;
    }
    this.activeSection.set('members');
    this.inviteError.set(null);
    this.accessPanel.set({kind: 'invite'});
  }

  /** Whether the current user may change anything about this member. */
  canManageMember(member: WorkspaceMember): boolean {
    return this.canEditMemberRole(member) || this.canEditMemberBilling(member)
      || this.canRemoveMember(member) || !!this.memberRemovalReason(member);
  }

  openMemberPanel(member: WorkspaceMember): void {
    if (!this.canManageMember(member)) {
      return;
    }
    this.memberEdits[member.user_id] = {role: member.role, billing_admin: member.billing_admin};
    this.accessPanel.set({kind: 'member', userId: member.user_id});
  }

  openInvitationPanel(invitation: WorkspaceInvitation): void {
    if (!this.canManageInvitation(invitation)) {
      return;
    }
    this.invitationEdits[invitation.id] = this.invitationDraft(invitation);
    this.accessPanel.set({kind: 'invitation', id: invitation.id});
  }

  /** Closes the access panel and drops its unsaved edits. */
  closeAccessPanel(): void {
    const panel = this.accessPanel();
    if (this.accessPanelBusy()) {
      return;
    }
    const member = this.panelMember();
    const invitation = this.panelInvitation();
    if (member) {
      this.memberEdits[member.user_id] = {role: member.role, billing_admin: member.billing_admin};
    }
    if (invitation) {
      this.invitationEdits[invitation.id] = this.invitationDraft(invitation);
    }
    if (panel?.kind === 'invite') {
      this.inviteError.set(null);
    }
    this.accessPanel.set(null);
  }

  accessPanelBusy(): boolean {
    const member = this.panelMember();
    const invitation = this.panelInvitation();
    return (!!member && !!this.savingMemberIds()[member.user_id])
      || (!!invitation && !!this.savingInvitationIds()[invitation.id])
      || (this.accessPanel()?.kind === 'invite' && this.sendingInvitation());
  }

  /** Saves the access panel: member access, invitation access, or a new invitation. */
  saveAccessPanel(): void {
    const member = this.panelMember();
    const invitation = this.panelInvitation();
    if (member) {
      this.saveMember(member);
    } else if (invitation) {
      this.saveInvitation(invitation);
    } else if (this.accessPanel()?.kind === 'invite') {
      this.sendInvitation();
    }
  }

  cancelOwnershipChange(): void {
    this.ownershipChange.set(null);
    this.rolePickerRevision.update(revision => revision + 1);
  }

  createWorkspace(): void {
    const name = this.newWorkspaceName.trim();
    if (!name || this.creatingWorkspace()) {
      return;
    }
    this.creatingWorkspace.set(true);
    this.http.createWorkspace(name).pipe(
      switchMap(created => this.workspaces.refresh().pipe(
        switchMap(() => this.workspaces.switchTo(created.id)),
      )),
      finalize(() => this.creatingWorkspace.set(false)),
    ).subscribe({
      error: error => this.showError('Could not create workspace', error),
    });
  }

  renameWorkspace(): void {
    const current = this.workspaces.current();
    const name = this.workspaceName.trim();
    if (!current || !name || name === current.name || !this.workspaces.canAdminister() || this.savingWorkspace()) {
      return;
    }
    this.savingWorkspace.set(true);
    this.http.renameWorkspace(current.id, name).pipe(
      switchMap(() => this.workspaces.refresh()),
      finalize(() => this.savingWorkspace.set(false)),
    ).subscribe({
      next: () => {
        this.workspaceName = this.workspaces.current()?.name ?? name;
        this.notification.showSuccess('Workspace renamed');
      },
      error: error => this.showError('Could not rename workspace', error),
    });
  }

  loadMembers(): void {
    const current = this.workspaces.current();
    if (!current) {
      return;
    }
    this.loadingMembers.set(true);
    this.membersError.set(null);
    this.http.getWorkspaceMembers(current.id).pipe(
      finalize(() => this.loadingMembers.set(false)),
    ).subscribe({
      next: members => {
        this.members.set(members);
        this.memberEdits = Object.fromEntries(members.map(member => [member.user_id, {
          role: member.role,
          billing_admin: member.billing_admin,
        }]));
      },
      error: error => this.membersError.set(this.errorMessage(error)),
    });
  }

  filteredMembers(): WorkspaceMember[] {
    const query = this.memberSearch().trim().toLowerCase();
    return query ? this.members().filter(member => member.email.toLowerCase().includes(query)) : this.members();
  }

  filteredInvitations(): WorkspaceInvitation[] {
    const query = this.memberSearch().trim().toLowerCase();
    return query
      ? this.invitations().filter(invitation => invitation.invitee_email.toLowerCase().includes(query))
      : this.invitations();
  }

  isCurrentUser(member: WorkspaceMember): boolean {
    const email = this.user.email();
    return !!email && member.email.toLowerCase() === email.toLowerCase();
  }

  setMemberRole(member: WorkspaceMember, role: WorkspaceRole): void {
    if (!this.canEditMemberRole(member)) {
      return;
    }
    if ((member.role === 'owner') !== (role === 'owner')) {
      this.ownershipChange.set({member, role});
      return;
    }
    this.updateMemberDraft(member.user_id, {role});
  }

  setMemberBilling(member: WorkspaceMember, billingAdmin: boolean): void {
    if (!this.canEditMemberBilling(member)) {
      return;
    }
    this.updateMemberDraft(member.user_id, {billing_admin: billingAdmin});
  }

  confirmOwnershipChange(): void {
    const change = this.ownershipChange();
    if (!change) {
      return;
    }
    const currentDraft = this.memberEdits[change.member.user_id] ?? {
      role: change.member.role,
      billing_admin: change.member.billing_admin,
    };
    const payload: WorkspaceMemberWriteRequest = {
      ...currentDraft,
      role: change.role,
      billing_admin: change.role === 'owner' ? true : currentDraft.billing_admin,
    };
    this.ownershipChange.set(null);
    this.saveMember(change.member, payload);
  }

  saveMember(member: WorkspaceMember, override?: WorkspaceMemberWriteRequest): void {
    const current = this.workspaces.current();
    const payload = override ?? this.memberEdits[member.user_id];
    if (!current || !payload || !this.canEditMember(member) || this.savingMemberIds()[member.user_id]) {
      return;
    }
    if (!override && !this.isMemberDirty(member)) {
      return;
    }
    this.setBusy(this.savingMemberIds, member.user_id, true);
    this.http.updateWorkspaceMember(current.id, member.user_id, payload).pipe(
      finalize(() => this.setBusy(this.savingMemberIds, member.user_id, false)),
    ).subscribe({
      next: () => {
        this.members.update(members => members.map(candidate => candidate.user_id === member.user_id
          ? {...candidate, role: payload.role, billing_admin: payload.billing_admin}
          : candidate));
        this.memberEdits[member.user_id] = {...payload};
        this.closePanelFor({kind: 'member', userId: member.user_id});
        this.notification.showSuccess('Member access updated');
        this.workspaces.refresh().subscribe({error: () => undefined});
      },
      error: error => this.showError('Could not update workspace member', error),
    });
  }

  requestMemberRemoval(member: WorkspaceMember): void {
    if (!this.canRemoveMember(member) || this.savingMemberIds()[member.user_id]) {
      return;
    }
    this.removalTarget.set(member);
  }

  confirmMemberRemoval(): void {
    const current = this.workspaces.current();
    const member = this.removalTarget();
    if (!current || !member || !this.canRemoveMember(member) || this.removingMember()) {
      return;
    }
    this.removingMember.set(true);
    this.http.removeWorkspaceMember(current.id, member.user_id).pipe(
      finalize(() => this.removingMember.set(false)),
    ).subscribe({
      next: () => {
        this.members.update(members => members.filter(candidate => candidate.user_id !== member.user_id));
        delete this.memberEdits[member.user_id];
        this.removalTarget.set(null);
        this.closePanelFor({kind: 'member', userId: member.user_id});
        this.notification.showSuccess('Workspace member removed');
        this.workspaces.refresh().subscribe({
          next: () => {
            if (this.workspaces.current()?.id !== current.id) {
              this.syncCurrentWorkspace();
            }
          },
          error: () => undefined,
        });
      },
      error: error => this.showError('Could not remove workspace member', error),
    });
  }

  canEditMember(member: WorkspaceMember): boolean {
    if (this.workspaces.isOwner()) {
      return member.role !== 'owner' || this.ownerCount() > 1;
    }
    return this.workspaces.current()?.role === 'admin'
      && (member.role === 'operator' || member.role === 'viewer')
      && !member.billing_admin;
  }

  canEditMemberRole(member: WorkspaceMember): boolean {
    return this.canEditMember(member);
  }

  canEditMemberBilling(member: WorkspaceMember): boolean {
    return this.workspaces.isOwner() && member.role !== 'owner';
  }

  canRemoveMember(member: WorkspaceMember): boolean {
    if (this.workspaces.isOwner()) {
      return member.role !== 'owner' || this.ownerCount() > 1;
    }
    return this.workspaces.current()?.role === 'admin'
      && (member.role === 'operator' || member.role === 'viewer')
      && !member.billing_admin;
  }

  memberRemovalReason(member: WorkspaceMember): string | undefined {
    if (member.role === 'owner' && this.ownerCount() <= 1 && this.workspaces.isOwner()) {
      return 'Transfer ownership first';
    }
    return undefined;
  }

  memberRoleOptions(): WorkspaceRole[] {
    return this.workspaces.isOwner() ? this.ownerMemberRoles : this.adminRoles;
  }

  isMemberDirty(member: WorkspaceMember): boolean {
    const edit = this.memberEdits[member.user_id];
    return !!edit && (edit.role !== member.role || edit.billing_admin !== member.billing_admin);
  }

  loadInvitations(): void {
    const current = this.workspaces.current();
    if (!current || !this.workspaces.canAdminister()) {
      return;
    }
    this.loadingInvitations.set(true);
    this.invitationsError.set(null);
    this.http.getWorkspaceInvitations(current.id).pipe(
      finalize(() => this.loadingInvitations.set(false)),
    ).subscribe({
      next: invitations => {
        this.invitations.set(this.sortInvitations(invitations));
        this.resetInvitationEdits(invitations);
      },
      error: error => this.invitationsError.set(this.errorMessage(error)),
    });
  }

  selectSection(tab: string): void {
    const section = this.sections.find(candidate => 'workspace-' + candidate.id === tab);
    if (section) {
      this.activeSection.set(section.id);
    }
  }

  sendInvitation(): void {
    const current = this.workspaces.current();
    const email = this.inviteEmail.trim();
    if (!current || !email || !this.workspaces.canAdminister() || this.sendingInvitation()) {
      return;
    }
    this.inviteError.set(null);
    this.sendingInvitation.set(true);
    this.http.createWorkspaceInvitation(current.id, {
      email,
      role: this.inviteRole,
      billing_admin: this.workspaces.isOwner() && this.inviteBillingAdmin,
    }).pipe(
      finalize(() => this.sendingInvitation.set(false)),
    ).subscribe({
      next: response => {
        this.invitations.update(invitations => this.sortInvitations([...invitations, response.invitation]));
        this.invitationEdits[response.invitation.id] = this.invitationDraft(response.invitation);
        this.inviteEmail = '';
        this.inviteRole = 'operator';
        this.inviteBillingAdmin = false;
        this.closePanelFor({kind: 'invite'});
        this.showInvitationResult('Invitation created', response);
      },
      error: error => {
        const message = this.errorMessage(error);
        this.inviteError.set(message);
        this.notification.showError(`Could not create invitation: ${message}`);
      },
    });
  }

  canManageInvitation(invitation: WorkspaceInvitation): boolean {
    if (this.workspaces.isOwner()) {
      return true;
    }
    return this.workspaces.current()?.role === 'admin'
      && invitation.role !== 'admin'
      && !invitation.billing_admin;
  }

  invitationRoleOptions(): InvitationRole[] {
    return this.workspaces.isOwner() ? this.ownerInvitationRoles : this.adminRoles;
  }

  setInvitationRole(invitation: WorkspaceInvitation, role: InvitationRole): void {
    if (!this.canManageInvitation(invitation)) {
      return;
    }
    this.invitationEdits[invitation.id] = {
      ...(this.invitationEdits[invitation.id] ?? this.invitationDraft(invitation)),
      role,
    };
  }

  setInvitationBilling(invitation: WorkspaceInvitation, billingAdmin: boolean): void {
    if (!this.workspaces.isOwner() || !this.canManageInvitation(invitation)) {
      return;
    }
    this.invitationEdits[invitation.id] = {
      ...(this.invitationEdits[invitation.id] ?? this.invitationDraft(invitation)),
      billing_admin: billingAdmin,
    };
  }

  invitationDirty(invitation: WorkspaceInvitation): boolean {
    const edit = this.invitationEdits[invitation.id];
    return !!edit && (edit.role !== invitation.role || edit.billing_admin !== invitation.billing_admin);
  }

  saveInvitation(invitation: WorkspaceInvitation): void {
    const current = this.workspaces.current();
    const payload = this.invitationEdits[invitation.id];
    if (!current || !payload || !this.canManageInvitation(invitation) || !this.invitationDirty(invitation) || this.savingInvitationIds()[invitation.id]) {
      return;
    }
    this.setBusy(this.savingInvitationIds, invitation.id, true);
    this.http.updateWorkspaceInvitation(current.id, invitation.id, payload).pipe(
      finalize(() => this.setBusy(this.savingInvitationIds, invitation.id, false)),
    ).subscribe({
      next: response => {
        this.invitations.update(invitations => invitations.map(candidate => candidate.id === invitation.id ? response.invitation : candidate));
        this.invitationEdits[invitation.id] = this.invitationDraft(response.invitation);
        this.closePanelFor({kind: 'invitation', id: invitation.id});
        this.showInvitationResult('Invitation updated', response);
      },
      error: error => this.showError('Could not update invitation', error),
    });
  }

  requestInvitationRevoke(invitation: WorkspaceInvitation): void {
    if (!this.canManageInvitation(invitation) || this.savingInvitationIds()[invitation.id]) {
      return;
    }
    this.revokeTarget.set(invitation);
  }

  confirmInvitationRevoke(): void {
    const current = this.workspaces.current();
    const invitation = this.revokeTarget();
    if (!current || !invitation || !this.canManageInvitation(invitation) || this.revokingInvitation()) {
      return;
    }
    this.revokingInvitation.set(true);
    this.http.revokeWorkspaceInvitation(current.id, invitation.id).pipe(
      finalize(() => this.revokingInvitation.set(false)),
    ).subscribe({
      next: () => {
        this.invitations.update(invitations => invitations.filter(candidate => candidate.id !== invitation.id));
        delete this.invitationEdits[invitation.id];
        this.revokeTarget.set(null);
        this.closePanelFor({kind: 'invitation', id: invitation.id});
        this.notification.showSuccess('Invitation revoked');
      },
      error: error => this.showError('Could not revoke invitation', error),
    });
  }

  notificationLabel(status: WorkspaceInvitation['notification_status']): string {
    switch (status) {
      case 'queued': return 'Email queued';
      case 'failed': return 'Email not sent';
      default: return 'Email not configured';
    }
  }

  notificationIcon(status: WorkspaceInvitation['notification_status']): string {
    switch (status) {
      case 'queued': return 'icon-send';
      case 'failed': return 'icon-circle-alert';
      default: return 'icon-circle-minus';
    }
  }

  /** The draft interval in seconds; 0 means automatic. */
  cadenceDraftSeconds(kind: CadenceKind): number {
    const draft = this.cadenceDrafts[kind];
    if (draft.mode === 'automatic') {
      return 0;
    }
    return Math.max(0, Math.round(Number(draft.value) || 0)) * cadenceUnitSeconds[draft.unit];
  }

  /** Whether the workspace has no monthly limit for checks or scrapes. */
  isUnlimited(kind: CadenceKind): boolean {
    const allowances = this.workspaces.current()?.allowances;
    return !!allowances && (kind === 'checks' ? allowances.unlimited_checks : allowances.unlimited_scrapes);
  }

  cadenceError(kind: CadenceKind): string | null {
    const allowances = this.workspaces.current()?.allowances;
    const seconds = this.cadenceDraftSeconds(kind);
    if (!allowances) {
      return null;
    }
    if (this.cadenceDrafts[kind].mode === 'automatic') {
      return this.isUnlimited(kind) ? 'This workspace has no monthly limit, so choose a fixed interval.' : null;
    }
    const minimum = kind === 'checks' ? allowances.minimum_check_interval_seconds : allowances.minimum_scrape_interval_seconds;
    if (seconds <= 0) {
      return 'Enter an interval.';
    }
    if (seconds < minimum) {
      return `The fastest interval this workspace allows is ${formatApproximateDuration(minimum).replace(/^every /, '')}.`;
    }
    if (seconds > 31 * 86400) {
      return 'The interval can be at most 31 days.';
    }
    return null;
  }

  /**
   * Warns while editing when a fixed interval would use more than the monthly
   * allowance. It is approximate: it uses the current number of active proxies
   * times enabled protocols (or subscribed sources) per cycle.
   */
  cadenceWarning(kind: CadenceKind): string | null {
    const allowances = this.workspaces.current()?.allowances;
    const seconds = this.cadenceDraftSeconds(kind);
    if (!allowances || seconds <= 0 || this.cadenceError(kind) || this.isUnlimited(kind)) {
      return null;
    }
    const perCycle = kind === 'checks' ? allowances.checks_per_cycle : allowances.scrapes_per_cycle;
    const monthly = kind === 'checks' ? allowances.monthly_checks : allowances.monthly_scrapes;
    const used = kind === 'checks' ? allowances.used_checks : allowances.used_scrapes;
    if (perCycle <= 0) {
      return null;
    }
    const start = new Date(allowances.period_start).getTime();
    const end = new Date(allowances.period_end).getTime();
    const projected = Math.ceil(perCycle * ((end - start) / 1000) / seconds);
    if (projected <= monthly) {
      return null;
    }
    const noun = kind === 'checks' ? 'checks' : 'scrapes';
    const cycles = Math.max(0, monthly - used) / perCycle;
    const runOut = Date.now() + cycles * seconds * 1000;
    const when = runOut < end
      ? ` At the current usage it runs out around ${new Date(runOut).toLocaleDateString(undefined, {dateStyle: 'medium'})}.`
      : '';
    return `This interval needs about ${projected.toLocaleString()} ${noun} a month, more than the allowance of ${monthly.toLocaleString()}. `
      + `${kind === 'checks' ? 'Checks' : 'Scraping'} stop when the allowance is used up.${when}`;
  }

  cadenceChanged(): boolean {
    const allowances = this.workspaces.current()?.allowances;
    if (!allowances) {
      return false;
    }
    return this.cadenceDraftSeconds('checks') !== allowances.requested_check_interval_seconds
      || this.cadenceDraftSeconds('scrapes') !== allowances.requested_scrape_interval_seconds;
  }

  saveCadence(): void {
    if (this.savingCadence() || this.cadenceError('checks') || this.cadenceError('scrapes')) {
      return;
    }
    this.savingCadence.set(true);
    this.http.updateWorkspaceCadence({
      check_interval_seconds: this.cadenceDraftSeconds('checks'),
      scrape_interval_seconds: this.cadenceDraftSeconds('scrapes'),
    }).pipe(
      switchMap(response => this.workspaces.refresh().pipe(switchMap(() => [response]))),
      finalize(() => this.savingCadence.set(false)),
    ).subscribe({
      next: response => {
        this.syncCurrentWorkspace();
        this.scheduleOpen.set(false);
        this.notification.showSuccess('Intervals saved. They apply within a minute.');
        for (const warning of response.warnings ?? []) {
          this.notification.showWarn(warning);
        }
      },
      error: error => this.showError('Could not save intervals', error),
    });
  }

  /** Whether the instance admin changed a workspace allowance from its saved value. */
  allowancesChanged(): boolean {
    const subscription = this.workspaces.current()?.subscription;
    if (!subscription) {
      return false;
    }
    return this.normalizeAllowance(this.allowanceChecks) !== subscription.monthly_checks
      || this.normalizeAllowance(this.allowanceScrapes) !== subscription.monthly_scrapes
      || this.allowanceUnlimitedChecks !== (subscription.unlimited_checks ?? false)
      || this.allowanceUnlimitedScrapes !== (subscription.unlimited_scrapes ?? false);
  }

  saveAllowances(): void {
    const current = this.workspaces.current();
    if (!current || this.savingAllowances() || !this.allowancesChanged()) {
      return;
    }
    const normalize = (value: number | null) => this.normalizeAllowance(value);
    this.savingAllowances.set(true);
    this.http.updateWorkspaceAllowances(current.id, {
      monthly_checks: normalize(this.allowanceChecks),
      monthly_scrapes: normalize(this.allowanceScrapes),
      unlimited_checks: this.allowanceUnlimitedChecks,
      unlimited_scrapes: this.allowanceUnlimitedScrapes,
    }).pipe(
      switchMap(() => this.workspaces.refresh()),
      finalize(() => this.savingAllowances.set(false)),
    ).subscribe({
      next: () => {
        this.syncCurrentWorkspace();
        this.notification.showSuccess('Allowances saved. Cadence updates within a minute.');
      },
      error: error => this.showError('Could not save allowances', error),
    });
  }

  capacityPercent(): number {
    const capacity = this.workspaces.current()?.capacity;
    if (!capacity || capacity.activation_limit === null || capacity.activation_limit <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((capacity.active_routes / capacity.activation_limit) * 100));
  }

  overflowStoredRoutes(): number {
    const capacity = this.workspaces.current()?.capacity;
    return capacity ? Math.max(0, capacity.stored_routes - capacity.active_routes) : 0;
  }

  capacityMessage(): string | null {
    const percent = this.capacityPercent();
    if (percent >= 100) {
      return 'Capacity reached. New routes stay stored and paused until capacity is available.';
    }
    if (percent >= 80) {
      return 'Capacity is above 80%. Review paused routes before the limit is reached.';
    }
    return null;
  }

  private forecastSeries(meter: AllowanceMeter, start: number, end: number, now: number): ForecastSeries {
    const allowances = this.workspaces.current()!.allowances;
    const perCycle = meter.id === 'checks' ? allowances.checks_per_cycle : allowances.scrapes_per_cycle;
    const interval = meter.id === 'checks' ? allowances.check_interval_seconds : allowances.scrape_interval_seconds;
    const runOutIso = meter.id === 'checks' ? allowances.checks_run_out_at : allowances.scrapes_run_out_at;
    const usedPercent = meter.exhausted ? 100 : Math.min(100, (meter.used / meter.monthly) * 100);
    const used = [{time: start, percent: 0}, {time: now, percent: usedPercent}];
    if (meter.exhausted) {
      return {id: meter.id, label: meter.label, color: meter.color, used, projected: [{time: now, percent: 100}, {time: end, percent: 100}], runOutAt: null};
    }
    const parsedRunOut = runOutIso ? Date.parse(runOutIso) : NaN;
    const runOutAt = Number.isFinite(parsedRunOut) && parsedRunOut < end ? Math.max(now, parsedRunOut) : null;
    if (runOutAt !== null) {
      return {
        id: meter.id, label: meter.label, color: meter.color, used, runOutAt,
        projected: [{time: now, percent: usedPercent}, {time: runOutAt, percent: 100}, {time: end, percent: 100}],
      };
    }
    // Cycles still to run this period at the current cadence, in allowance percent.
    const perSecond = perCycle > 0 && interval > 0 ? perCycle / interval : 0;
    const projectedEnd = Math.min(100, usedPercent + ((perSecond * (end - now)) / 1000 / meter.monthly) * 100);
    return {
      id: meter.id, label: meter.label, color: meter.color, used, runOutAt: null,
      projected: [{time: now, percent: usedPercent}, {time: end, percent: projectedEnd}],
    };
  }

  /** Closes the access panel when it still shows the entity that was just saved or removed. */
  private closePanelFor(target: AccessPanel): void {
    const panel = this.accessPanel();
    if (!panel || panel.kind !== target.kind) {
      return;
    }
    if ((panel.kind === 'member' && target.kind === 'member' && panel.userId !== target.userId)
      || (panel.kind === 'invitation' && target.kind === 'invitation' && panel.id !== target.id)) {
      return;
    }
    this.accessPanel.set(null);
  }

  /** Empty, negative or fractional entries are stored as whole numbers; 0 means the instance default. */
  private normalizeAllowance(value: number | null): number {
    return Math.max(0, Math.round(Number(value) || 0));
  }

  private updateMemberDraft(userId: number, update: Partial<WorkspaceMemberWriteRequest>): void {
    const fallback = this.members().find(member => member.user_id === userId);
    if (!fallback) {
      return;
    }
    this.memberEdits[userId] = {
      ...(this.memberEdits[userId] ?? {role: fallback.role, billing_admin: fallback.billing_admin}),
      ...update,
    };
  }

  private resetInvitationEdits(invitations: WorkspaceInvitation[]): void {
    this.invitationEdits = Object.fromEntries(invitations.map(invitation => [invitation.id, this.invitationDraft(invitation)]));
  }

  private invitationDraft(invitation: WorkspaceInvitation): WorkspaceInvitationWriteRequest {
    return {role: invitation.role, billing_admin: invitation.billing_admin};
  }

  private sortInvitations(invitations: WorkspaceInvitation[]): WorkspaceInvitation[] {
    return [...invitations].sort((left, right) => left.invitee_email.localeCompare(right.invitee_email));
  }

  private setBusy(
    target: {update: (updateFn: (value: Record<number, boolean>) => Record<number, boolean>) => void},
    id: number,
    busy: boolean,
  ): void {
    target.update(current => {
      const next = {...current};
      if (busy) {
        next[id] = true;
      } else {
        delete next[id];
      }
      return next;
    });
  }

  private showInvitationResult(successMessage: string, response: WorkspaceInvitationResponse): void {
    if (response.warning) {
      this.notification.showWarn(`${successMessage}. ${response.warning}`);
      return;
    }
    this.notification.showSuccess(successMessage);
  }

  private showError(prefix: string, error: any): void {
    this.notification.showError(`${prefix}: ${this.errorMessage(error)}`);
  }

  private errorMessage(error: any): string {
    return error?.error?.error ?? error?.error?.message ?? error?.message ?? 'Unknown error';
  }
}
