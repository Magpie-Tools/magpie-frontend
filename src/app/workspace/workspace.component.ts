import {CommonModule, DatePipe, DecimalPipe, TitleCasePipe} from '@angular/common';
import {Component, OnInit, computed, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {DialogModule} from 'primeng/dialog';
import {SkeletonModule} from 'primeng/skeleton';
import {TooltipModule} from 'primeng/tooltip';
import {finalize, switchMap} from 'rxjs/operators';
import {
  WorkspaceInvitation,
  WorkspaceInvitationResponse,
  WorkspaceInvitationWriteRequest,
  WorkspaceMember,
  WorkspaceMemberWriteRequest,
  WorkspaceRole,
} from '../models/Workspace';
import {HttpService} from '../services/http.service';
import {NotificationService} from '../services/notification-service.service';
import {WorkspaceService} from '../services/workspace.service';

type InvitationRole = WorkspaceInvitation['role'];

interface OwnershipChange {
  member: WorkspaceMember;
  role: WorkspaceRole;
}

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    DecimalPipe,
    TitleCasePipe,
    DialogModule,
    SkeletonModule,
    TooltipModule,
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
  readonly createExpanded = signal(false);
  readonly memberSearch = signal('');
  readonly removalTarget = signal<WorkspaceMember | null>(null);
  readonly revokeTarget = signal<WorkspaceInvitation | null>(null);
  readonly ownershipChange = signal<OwnershipChange | null>(null);
  readonly removingMember = signal(false);
  readonly revokingInvitation = signal(false);

  readonly showMemberSearch = computed(() => this.members().length > 8);
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

  ngOnInit(): void {
    this.loadWorkspace();
  }

  loadWorkspace(force = false): void {
    this.workspaceError.set(null);
    this.workspaces.load(force).subscribe({
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
    this.loadMembers();
    if (this.workspaces.canAdminister()) {
      this.loadInvitations();
    } else {
      this.invitations.set([]);
      this.invitationsError.set(null);
    }
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
        if (members.length <= 8) {
          this.memberSearch.set('');
        }
      },
      error: error => this.membersError.set(this.errorMessage(error)),
    });
  }

  filteredMembers(): WorkspaceMember[] {
    const query = this.memberSearch().trim().toLowerCase();
    if (!query || !this.showMemberSearch()) {
      return this.members();
    }
    return this.members().filter(member => member.email.toLowerCase().includes(query));
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
      case 'queued': return 'pi-send';
      case 'failed': return 'pi-exclamation-circle';
      default: return 'pi-minus-circle';
    }
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
