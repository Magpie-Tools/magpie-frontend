import {computed, Injectable, signal} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {finalize, shareReplay, takeUntil, tap} from 'rxjs/operators';
import {WorkspaceInvitation, WorkspaceInvitationAcceptance} from '../models/Workspace';
import {HttpService} from './http.service';

@Injectable({providedIn: 'root'})
export class WorkspaceInvitationService {
  readonly invitations = signal<WorkspaceInvitation[]>([]);
  readonly pendingCount = computed(() => this.invitations().length);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private loadRequest?: Observable<WorkspaceInvitation[]>;
  private readonly sessionReset = new Subject<void>();
  private sessionVersion = 0;
  private loadRequestId = 0;

  constructor(private readonly http: HttpService) {}

  load(force = false): Observable<WorkspaceInvitation[]> {
    if (!force && this.loadRequest) {
      return this.loadRequest;
    }

    this.loading.set(true);
    this.error.set(null);
    const sessionVersion = this.sessionVersion;
    const requestId = ++this.loadRequestId;
    this.loadRequest = this.http.getPendingWorkspaceInvitations().pipe(
      takeUntil(this.sessionReset),
      tap({
        next: invitations => {
          if (!this.isCurrentRequest(sessionVersion, requestId)) {
            return;
          }
          this.invitations.set(invitations);
        },
        error: error => {
          if (!this.isCurrentRequest(sessionVersion, requestId)) {
            return;
          }
          this.error.set(this.errorMessage(error));
        },
      }),
      finalize(() => {
        if (!this.isCurrentRequest(sessionVersion, requestId)) {
          return;
        }
        this.loading.set(false);
        this.loadRequest = undefined;
      }),
      shareReplay({bufferSize: 1, refCount: false}),
    );
    return this.loadRequest;
  }

  accept(invitationId: number): Observable<WorkspaceInvitationAcceptance> {
    return this.http.acceptWorkspaceInvitation(invitationId).pipe(
      tap(() => this.removeFromInbox(invitationId)),
    );
  }

  decline(invitationId: number): Observable<void> {
    return this.http.declineWorkspaceInvitation(invitationId).pipe(
      tap(() => this.removeFromInbox(invitationId)),
    );
  }

  reset(): void {
    this.sessionVersion += 1;
    this.loadRequestId += 1;
    this.sessionReset.next();
    this.loadRequest = undefined;
    this.loading.set(false);
    this.error.set(null);
    this.invitations.set([]);
  }

  private removeFromInbox(invitationId: number): void {
    this.invitations.update(invitations => invitations.filter(invitation => invitation.id !== invitationId));
  }

  private isCurrentRequest(sessionVersion: number, requestId: number): boolean {
    return sessionVersion === this.sessionVersion && requestId === this.loadRequestId;
  }

  private errorMessage(error: any): string {
    return error?.error?.error ?? error?.error?.message ?? error?.message ?? 'Could not load invitations';
  }
}
