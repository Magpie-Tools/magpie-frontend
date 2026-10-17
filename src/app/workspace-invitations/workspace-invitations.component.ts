import {HlmSkeleton} from '@spartan-ng/helm/skeleton';
import {HlmTooltip} from '@spartan-ng/helm/tooltip';
import {CommonModule, DatePipe, TitleCasePipe} from '@angular/common';
import {Component, DestroyRef, effect, inject, OnInit, signal, untracked} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';

import {finalize, map, switchMap} from 'rxjs/operators';
import {WorkspaceInvitation, WorkspaceInvitationAcceptance} from '../models/Workspace';
import {NotificationService} from '../services/notification-service.service';
import {WorkspaceInvitationService} from '../services/workspace-invitation.service';
import {WorkspaceService} from '../services/workspace.service';
import {RevealGroupDirective} from '../shared/reveal-group.directive';
import {VisibleRowsDirective} from '../shared/visible-rows.directive';
import {NotificationFocusService, parseNotificationTargetId} from '../shared/notification-focus.service';

@Component({
  selector: 'app-workspace-invitations',
  standalone: true,
  providers: [NotificationFocusService],
  imports: [HlmSkeleton, HlmTooltip, RevealGroupDirective, VisibleRowsDirective, CommonModule, DatePipe, TitleCasePipe],
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
  readonly acceptedWorkspace = signal<WorkspaceInvitationAcceptance | null>(null);
  readonly openingWorkspace = signal(false);

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
    this.invitations.accept(invitation.id).pipe(
      switchMap(accepted => this.workspaces.refresh().pipe(map(() => accepted))),
      finalize(() => this.setBusy(this.acceptingIds, invitation.id, false)),
    ).subscribe({
      next: accepted => {
        this.acceptedWorkspace.set(accepted);
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

  openAcceptedWorkspace(): void {
    const accepted = this.acceptedWorkspace();
    if (!accepted || this.openingWorkspace()) {
      return;
    }
    this.openingWorkspace.set(true);
    this.workspaces.switchTo(accepted.workspace_id, false).pipe(
      switchMap(() => this.router.navigate(['/workspace'])),
      finalize(() => this.openingWorkspace.set(false)),
    ).subscribe({
      error: error => this.showError('Could not open workspace', error),
    });
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
