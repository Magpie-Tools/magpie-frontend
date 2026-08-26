import {computed, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {WorkspaceInvitation} from '../models/Workspace';
import {NotificationService} from '../services/notification-service.service';
import {WorkspaceInvitationService} from '../services/workspace-invitation.service';
import {WorkspaceService} from '../services/workspace.service';
import {WorkspaceInvitationsComponent} from './workspace-invitations.component';

describe('WorkspaceInvitationsComponent', () => {
  let component: WorkspaceInvitationsComponent;
  let fixture: ComponentFixture<WorkspaceInvitationsComponent>;
  let accept: jasmine.Spy;
  let decline: jasmine.Spy;
  let refresh: jasmine.Spy;
  let switchTo: jasmine.Spy;
  const pending = signal<WorkspaceInvitation[]>([]);

  const invitation: WorkspaceInvitation = {
    id: 4,
    workspace_id: 12,
    workspace_name: 'Research',
    invitee_user_id: 7,
    invitee_email: 'recipient@example.test',
    inviter_user_id: 2,
    inviter_email: 'owner@example.test',
    role: 'viewer',
    billing_admin: false,
    notification_status: 'queued',
    expires_at: '2026-09-02T00:00:00Z',
    created_at: '2026-08-26T00:00:00Z',
    updated_at: '2026-08-26T00:00:00Z',
  };

  beforeEach(async () => {
    pending.set([invitation]);
    accept = jasmine.createSpy('accept').and.returnValue(of({workspace_id: 12, workspace_name: 'Research'}));
    decline = jasmine.createSpy('decline').and.returnValue(of(undefined));
    refresh = jasmine.createSpy('refresh').and.returnValue(of([]));
    switchTo = jasmine.createSpy('switchTo').and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [WorkspaceInvitationsComponent],
      providers: [
        provideRouter([]),
        {
          provide: WorkspaceInvitationService,
          useValue: {
            invitations: pending,
            pendingCount: computed(() => pending().length),
            loading: signal(false),
            error: signal(null),
            load: () => of(pending()),
            accept,
            decline,
          },
        },
        {
          provide: WorkspaceService,
          useValue: {
            refresh,
            switchTo,
          },
        },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', ['showSuccess', 'showError']),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspaceInvitationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('accepts without switching the current workspace and offers an explicit Open action', () => {
    component.accept(invitation);
    fixture.detectChanges();

    expect(accept).toHaveBeenCalledWith(invitation.id);
    expect(refresh).toHaveBeenCalled();
    expect(switchTo).not.toHaveBeenCalled();
    expect(component.acceptedWorkspace()).toEqual({workspace_id: 12, workspace_name: 'Research'});
    expect(fixture.nativeElement.querySelector('.accepted-notice').textContent).toContain('current workspace was not changed');
    expect(fixture.nativeElement.querySelector('.accepted-notice button').textContent).toContain('Open workspace');

    component.openAcceptedWorkspace();
    expect(switchTo).toHaveBeenCalledWith(invitation.workspace_id, false);
  });

  it('declines through the account-bound invitation service', () => {
    component.decline(invitation);
    expect(decline).toHaveBeenCalledWith(invitation.id);
  });
});
