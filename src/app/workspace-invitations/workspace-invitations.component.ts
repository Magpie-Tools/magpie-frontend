import {CommonModule, DatePipe, TitleCasePipe} from '@angular/common';
import {AfterViewInit, Component, ElementRef, OnDestroy, OnInit, signal} from '@angular/core';
import {Router} from '@angular/router';
import {SkeletonModule} from 'primeng/skeleton';
import {finalize, map, switchMap} from 'rxjs/operators';
import {WorkspaceInvitation, WorkspaceInvitationAcceptance} from '../models/Workspace';
import {NotificationService} from '../services/notification-service.service';
import {WorkspaceInvitationService} from '../services/workspace-invitation.service';
import {WorkspaceService} from '../services/workspace.service';
import {gsap} from 'gsap';

@Component({
  selector: 'app-workspace-invitations',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe, SkeletonModule],
  templateUrl: './workspace-invitations.component.html',
  styleUrl: './workspace-invitations.component.scss',
})
export class WorkspaceInvitationsComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly acceptingIds = signal<Record<number, boolean>>({});
  readonly decliningIds = signal<Record<number, boolean>>({});
  readonly acceptedWorkspace = signal<WorkspaceInvitationAcceptance | null>(null);
  readonly openingWorkspace = signal(false);
  private animationContext?: gsap.Context;

  constructor(
    readonly invitations: WorkspaceInvitationService,
    private readonly workspaces: WorkspaceService,
    private readonly router: Router,
    private readonly notification: NotificationService,
    private readonly elementRef: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngAfterViewInit(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    this.animationContext = gsap.context(() => {
      gsap.fromTo(
        '.invitation-context, .accepted-notice, .invitation-card',
        {opacity: 0, y: 24, scale: 0.985},
        {opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.065, ease: 'power3.out', clearProps: 'transform'},
      );
      gsap.fromTo(
        '.workspace-avatar, .flow-node',
        {opacity: 0, scale: 0.76},
        {opacity: 1, scale: 1, duration: 0.52, stagger: 0.06, delay: 0.16, ease: 'back.out(1.35)'},
      );
    }, this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.animationContext?.revert();
  }

  load(): void {
    this.invitations.load(true).subscribe({error: () => undefined});
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
