import {CommonModule, DatePipe, NgClass, TitleCasePipe} from '@angular/common';
import {Component, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {finalize, switchMap} from 'rxjs/operators';
import {
  WorkspaceMember,
  WorkspaceMemberCreateRequest,
  WorkspaceRole,
} from '../models/Workspace';
import {HttpService} from '../services/http.service';
import {NotificationService} from '../services/notification-service.service';
import {WorkspaceService} from '../services/workspace.service';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, TitleCasePipe, NgClass],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.scss',
})
export class WorkspaceComponent implements OnInit {
  readonly members = signal<WorkspaceMember[]>([]);
  readonly loadingMembers = signal(false);
  readonly savingWorkspace = signal(false);
  readonly creatingWorkspace = signal(false);
  readonly addingMember = signal(false);
  readonly savingMemberIds = signal<Record<number, boolean>>({});

  workspaceName = '';
  newWorkspaceName = '';
  inviteEmail = '';
  inviteRole: WorkspaceRole = 'operator';
  inviteBillingAdmin = false;

  readonly memberRoles: WorkspaceRole[] = ['owner', 'admin', 'operator', 'viewer'];
  readonly inviteRoles: WorkspaceRole[] = ['admin', 'operator', 'viewer'];

  constructor(
    readonly workspaces: WorkspaceService,
    private readonly http: HttpService,
    private readonly notification: NotificationService,
  ) {}

  ngOnInit(): void {
    this.workspaces.load().subscribe({
      next: () => this.syncCurrentWorkspace(),
      error: error => this.showError('Could not load workspace', error),
    });
  }

  syncCurrentWorkspace(): void {
    const current = this.workspaces.current();
    if (!current) {
      this.workspaceName = '';
      this.members.set([]);
      return;
    }
    this.workspaceName = current.name;
    this.loadMembers();
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
    this.http.getWorkspaceMembers(current.id).pipe(
      finalize(() => this.loadingMembers.set(false)),
    ).subscribe({
      next: members => this.members.set(members),
      error: error => this.showError('Could not load workspace members', error),
    });
  }

  addMember(): void {
    const current = this.workspaces.current();
    const email = this.inviteEmail.trim();
    if (!current || !email || !this.workspaces.canAdminister() || this.addingMember()) {
      return;
    }
    const payload: WorkspaceMemberCreateRequest = {
      email,
      role: this.inviteRole,
      billing_admin: this.workspaces.isOwner() && this.inviteBillingAdmin,
    };
    this.addingMember.set(true);
    this.http.addWorkspaceMember(current.id, payload).pipe(
      finalize(() => this.addingMember.set(false)),
    ).subscribe({
      next: member => {
        this.members.update(members => [...members, member]);
        this.inviteEmail = '';
        this.inviteRole = 'operator';
        this.inviteBillingAdmin = false;
        this.notification.showSuccess('Workspace member added');
      },
      error: error => this.showError('Could not add workspace member', error),
    });
  }

  saveMember(member: WorkspaceMember): void {
    const current = this.workspaces.current();
    if (!current || !this.canEditMember(member) || this.savingMemberIds()[member.user_id]) {
      return;
    }
    this.setMemberSaving(member.user_id, true);
    this.http.updateWorkspaceMember(current.id, member.user_id, {
      role: member.role,
      // Admins cannot change billing access, but they must preserve an
      // existing billing flag while changing an otherwise editable role.
      billing_admin: member.billing_admin,
    }).pipe(
      finalize(() => this.setMemberSaving(member.user_id, false)),
    ).subscribe({
      next: () => {
        this.notification.showSuccess('Workspace member updated');
        this.loadMembers();
      },
      error: error => {
        this.showError('Could not update workspace member', error);
        this.loadMembers();
      },
    });
  }

  removeMember(member: WorkspaceMember): void {
    const current = this.workspaces.current();
    if (!current || !this.canEditMember(member) || this.savingMemberIds()[member.user_id]) {
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(`Remove ${member.email} from this workspace?`)) {
      return;
    }
    this.setMemberSaving(member.user_id, true);
    this.http.removeWorkspaceMember(current.id, member.user_id).pipe(
      finalize(() => this.setMemberSaving(member.user_id, false)),
    ).subscribe({
      next: () => {
        this.members.update(members => members.filter(candidate => candidate.user_id !== member.user_id));
        this.notification.showSuccess('Workspace member removed');
      },
      error: error => this.showError('Could not remove workspace member', error),
    });
  }

  canEditMember(member: WorkspaceMember): boolean {
    if (!this.workspaces.canAdminister()) {
      return false;
    }
    return member.role !== 'owner' || this.workspaces.isOwner();
  }

  capacityPercent(): number {
    const capacity = this.workspaces.current()?.capacity;
    if (!capacity || capacity.activation_limit === null) {
      return 0;
    }
    if (capacity.activation_limit <= 0) {
      return 100;
    }
    return Math.min(100, Math.round((capacity.active_routes / capacity.activation_limit) * 100));
  }

  overflowStoredRoutes(): number {
    const capacity = this.workspaces.current()?.capacity;
    return capacity ? Math.max(0, capacity.stored_routes - capacity.active_routes) : 0;
  }

  private setMemberSaving(userId: number, saving: boolean): void {
    this.savingMemberIds.update(current => {
      const next = {...current};
      if (saving) {
        next[userId] = true;
      } else {
        delete next[userId];
      }
      return next;
    });
  }

  private showError(prefix: string, error: any): void {
    const message = error?.error?.error ?? error?.error?.message ?? error?.message ?? 'Unknown error';
    this.notification.showError(`${prefix}: ${message}`);
  }
}
