import {HlmBadge} from '@spartan-ng/helm/badge';
import {HlmSkeleton} from '@spartan-ng/helm/skeleton';
import {HlmTooltip} from '@spartan-ng/helm/tooltip';
import {CommonModule, DatePipe, TitleCasePipe} from '@angular/common';
import {Component, computed, DestroyRef, effect, inject, OnInit, signal, untracked} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';

import {finalize, map, switchMap} from 'rxjs/operators';
import {ROLE_DESCRIPTIONS, WorkspaceInvitation, WorkspaceInvitationAcceptance} from '../models/Workspace';
import {NotificationService} from '../services/notification-service.service';
import {WorkspaceInvitationService} from '../services/workspace-invitation.service';
import {WorkspaceService} from '../services/workspace.service';
import {NotificationFocusService, parseNotificationTargetId} from '../shared/notification-focus.service';

/** An invitation accepted on this visit. It keeps its row so the user can open the workspace from there. */
interface JoinedInvitation {
  invitation: WorkspaceInvitation;
  workspace: WorkspaceInvitationAcceptance;
  /** Where the row sat in the inbox when it was accepted. */
  index: number;
}

export type InvitationRow =
  | {kind: 'pending'; invitation: WorkspaceInvitation}
  | {kind: 'joined'; invitation: WorkspaceInvitation; workspace: WorkspaceInvitationAcceptance};

export interface InvitationExpiry {
  /** "in 7 days", "tomorrow", "today". */
  relative: string;
  /** Three days or fewer left. */
  soon: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRES_SOON_DAYS = 3;

@Component({
  selector: 'app-workspace-invitations',
  standalone: true,
  providers: [NotificationFocusService],
  imports: [HlmBadge, HlmSkeleton, HlmTooltip, CommonModule, DatePipe, TitleCasePipe],
  templateUrl: './workspace-invitations.component.html',
  styleUrl: './workspace-invitations.component.scss',
})
export class WorkspaceInvitationsComponent implements OnInit {
  private readonly notificationFocus = inject(NotificationFocusService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requestedInvitationId = signal<number | null>(null);
  readonly highlightedInvitationId = this.notificationFocus.highlightedId;
  readonly acceptingIds = signal<Record<number, boolean>>({});
  readonly decliningIds = signal<Record<number, boolean>>({});
  readonly joined = signal<JoinedInvitation[]>([]);
  readonly openingWorkspaceId = signal<number | null>(null);
  readonly roleDescriptions = ROLE_DESCRIPTIONS;
  readonly currentWorkspaceName = computed(() => this.workspaces.current()?.name ?? 'your current workspace');

  /** Pending invitations, with the ones accepted on this visit back in the place they were. */
  readonly rows = computed<InvitationRow[]>(() => {
    const rows: InvitationRow[] = this.invitations.invitations()
      .map(invitation => ({kind: 'pending' as const, invitation}));
    for (const entry of [...this.joined()].sort((a, b) => a.index - b.index)) {
      rows.splice(Math.min(entry.index, rows.length), 0, {kind: 'joined', invitation: entry.invitation, workspace: entry.workspace});
    }
    return rows;
  });

  constructor(
    readonly invitations: WorkspaceInvitationService,
    private readonly workspaces: WorkspaceService,
    private readonly router: Router,
    private readonly notification: NotificationService,
    private readonly route: ActivatedRoute,
  ) {
    effect(() => {
      const id = this.requestedInvitationId();
      const loading = this.invitations.loading();
      const error = this.invitations.error();
      const pending = this.invitations.invitations();
      const highlightedId = this.highlightedInvitationId();
      untracked(() => {
        this.notificationFocus.cancelPending();
        if (highlightedId && !pending.some(invitation => invitation.id === highlightedId)) this.notificationFocus.clear();
        if (!id || loading || error) return;
        if (!pending.some(invitation => invitation.id === id)) {
          this.consumeInvitationLink(id);
          return;
        }
        this.notificationFocus.schedule({
          id,
          selector: `#workspace-invitation-${id}`,
          isCurrent: () => this.requestedInvitationId() === id && !this.invitations.loading() && !this.invitations.error()
            && this.invitations.invitations().some(invitation => invitation.id === id),
          onFocused: () => this.consumeInvitationLink(id),
          onMissing: () => this.consumeInvitationLink(id),
        });
      });
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.notificationFocus.cancelPending();
      const id = parseNotificationTargetId(params.get('invitation'));
      if (id) this.notificationFocus.clear();
      this.requestedInvitationId.set(id);
    });
    this.load();
  }

  load(): void {
    this.invitations.load(true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({error: () => undefined});
  }

  private consumeInvitationLink(id: number): void {
    this.requestedInvitationId.set(null);
    if (this.route.snapshot.queryParamMap.get('invitation') === String(id)) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {invitation: null},
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  accept(invitation: WorkspaceInvitation): void {
    if (this.acceptingIds()[invitation.id] || this.decliningIds()[invitation.id]) {
      return;
    }
    this.setBusy(this.acceptingIds, invitation.id, true);
    const index = Math.max(0, this.rows().findIndex(row => row.invitation.id === invitation.id));
    this.invitations.accept(invitation.id).pipe(
      switchMap(accepted => this.workspaces.refresh().pipe(map(() => accepted))),
      finalize(() => this.setBusy(this.acceptingIds, invitation.id, false)),
    ).subscribe({
      next: accepted => {
        this.joined.update(current => [
          ...current.filter(entry => entry.invitation.id !== invitation.id),
          {invitation, workspace: accepted, index},
        ]);
        this.notification.showSuccess(`You joined ${accepted.workspace_name}`);
      },
      error: error => this.showError('Could not accept invitation', error),
    });
  }

  decline(invitation: WorkspaceInvitation): void {
    if (this.acceptingIds()[invitation.id] || this.decliningIds()[invitation.id]) {
      return;
    }
    this.setBusy(this.decliningIds, invitation.id, true);
    this.invitations.decline(invitation.id).pipe(
      finalize(() => this.setBusy(this.decliningIds, invitation.id, false)),
    ).subscribe({
      next: () => this.notification.showSuccess(`Invitation to ${invitation.workspace_name} declined`),
      error: error => this.showError('Could not decline invitation', error),
    });
  }

  openWorkspace(workspace: WorkspaceInvitationAcceptance): void {
    if (this.openingWorkspaceId() !== null) {
      return;
    }
    this.openingWorkspaceId.set(workspace.workspace_id);
    this.workspaces.switchTo(workspace.workspace_id, false).pipe(
      switchMap(() => this.router.navigate(['/workspace'])),
      finalize(() => this.openingWorkspaceId.set(null)),
    ).subscribe({
      error: error => this.showError('Could not open workspace', error),
    });
  }

  expiry(invitation: WorkspaceInvitation, now = Date.now()): InvitationExpiry {
    const days = Math.ceil((new Date(invitation.expires_at).getTime() - now) / DAY_MS);
    const relative = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
    return {relative, soon: days <= EXPIRES_SOON_DAYS};
  }

  invitationBusy(invitationId: number): boolean {
    return !!this.acceptingIds()[invitationId] || !!this.decliningIds()[invitationId];
  }

  private setBusy(target: {update: (updateFn: (value: Record<number, boolean>) => Record<number, boolean>) => void}, invitationId: number, busy: boolean): void {
    target.update(current => {
      const next = {...current};
      if (busy) {
        next[invitationId] = true;
      } else {
        delete next[invitationId];
      }
      return next;
    });
  }

  private showError(prefix: string, error: any): void {
    const message = error?.error?.error ?? error?.error?.message ?? error?.message ?? 'Unknown error';
    this.notification.showError(`${prefix}: ${message}`);
  }
}
