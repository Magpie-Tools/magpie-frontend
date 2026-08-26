import {TestBed} from '@angular/core/testing';
import {Subject, of} from 'rxjs';
import {WorkspaceInvitation} from '../models/Workspace';
import {HttpService} from './http.service';
import {WorkspaceInvitationService} from './workspace-invitation.service';

describe('WorkspaceInvitationService', () => {
  let service: WorkspaceInvitationService;
  let http: jasmine.SpyObj<HttpService>;

  const invitation: WorkspaceInvitation = {
    id: 3,
    workspace_id: 10,
    workspace_name: 'Operations',
    invitee_user_id: 5,
    invitee_email: 'recipient@example.test',
    inviter_user_id: 1,
    inviter_email: 'owner@example.test',
    role: 'operator',
    billing_admin: false,
    notification_status: 'not_configured',
    expires_at: '2026-09-02T00:00:00Z',
    created_at: '2026-08-26T00:00:00Z',
    updated_at: '2026-08-26T00:00:00Z',
  };

  beforeEach(() => {
    http = jasmine.createSpyObj<HttpService>('HttpService', [
      'getPendingWorkspaceInvitations',
      'acceptWorkspaceInvitation',
      'declineWorkspaceInvitation',
    ]);
    TestBed.configureTestingModule({
      providers: [
        WorkspaceInvitationService,
        {provide: HttpService, useValue: http},
      ],
    });
    service = TestBed.inject(WorkspaceInvitationService);
  });

  it('loads pending invitations and removes an accepted invitation from the count', () => {
    http.getPendingWorkspaceInvitations.and.returnValue(of([invitation]));
    http.acceptWorkspaceInvitation.and.returnValue(of({workspace_id: invitation.workspace_id, workspace_name: invitation.workspace_name}));

    service.load().subscribe();
    expect(service.pendingCount()).toBe(1);

    service.accept(invitation.id).subscribe();
    expect(service.pendingCount()).toBe(0);
  });

  it('does not restore invitations from an old session request after reset', () => {
    const firstRequest = new Subject<WorkspaceInvitation[]>();
    http.getPendingWorkspaceInvitations.and.returnValues(firstRequest, of([]));

    service.load().subscribe();
    service.reset();
    service.load().subscribe();
    firstRequest.next([invitation]);
    firstRequest.complete();

    expect(service.invitations()).toEqual([]);
    expect(service.pendingCount()).toBe(0);
    expect(service.loading()).toBeFalse();
  });
});
