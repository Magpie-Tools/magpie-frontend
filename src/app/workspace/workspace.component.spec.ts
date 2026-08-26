import {ComponentFixture, TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {of, throwError} from 'rxjs';
import {
  Workspace,
  WorkspaceInvitationResponse,
  WorkspaceMember,
} from '../models/Workspace';
import {HttpService} from '../services/http.service';
import {NotificationService} from '../services/notification-service.service';
import {WorkspaceService} from '../services/workspace.service';
import {WorkspaceComponent} from './workspace.component';

describe('WorkspaceComponent', () => {
  let component: WorkspaceComponent;
  let fixture: ComponentFixture<WorkspaceComponent>;
  let http: jasmine.SpyObj<HttpService>;
  let notification: jasmine.SpyObj<NotificationService>;
  let canAdminister: ReturnType<typeof signal<boolean>>;
  let isOwner: ReturnType<typeof signal<boolean>>;

  const workspace: Workspace = {
    id: 17,
    name: 'Production',
    personal: false,
    role: 'owner',
    billing_admin: true,
    is_default: true,
    capacity: {
      active_routes: 750,
      stored_routes: 900,
      included_routes: 1000,
      additional_routes: 0,
      overage_routes: 0,
      activation_limit: 1000,
      overage_mode: 'disabled',
    },
    subscription: {
      plan_code: 'self-hosted',
      status: 'active',
      included_operators: 3,
      statistics_retention_days: 30,
      minimum_check_interval_seconds: 60,
      cancel_at_period_end: false,
    },
    created_at: '2026-08-01T00:00:00Z',
  };

  const owner: WorkspaceMember = {
    user_id: 1,
    email: 'owner@example.test',
    role: 'owner',
    billing_admin: true,
    joined_at: '2026-08-01T00:00:00Z',
  };

  const operator: WorkspaceMember = {
    user_id: 2,
    email: 'operator@example.test',
    role: 'operator',
    billing_admin: false,
    joined_at: '2026-08-02T00:00:00Z',
  };

  beforeEach(async () => {
    canAdminister = signal(true);
    isOwner = signal(true);
    http = jasmine.createSpyObj<HttpService>('HttpService', [
      'getWorkspaceMembers',
      'getWorkspaceInvitations',
      'createWorkspaceInvitation',
      'updateWorkspaceMember',
      'updateWorkspaceInvitation',
      'removeWorkspaceMember',
      'revokeWorkspaceInvitation',
      'renameWorkspace',
      'createWorkspace',
    ]);
    http.getWorkspaceMembers.and.returnValue(of([owner, operator]));
    http.getWorkspaceInvitations.and.returnValue(of([]));
    http.updateWorkspaceMember.and.returnValue(of(undefined));
    http.removeWorkspaceMember.and.returnValue(of(undefined));
    http.renameWorkspace.and.returnValue(of(undefined));

    notification = jasmine.createSpyObj<NotificationService>('NotificationService', [
      'showError',
      'showSuccess',
      'showWarn',
    ]);

    await TestBed.configureTestingModule({
      imports: [WorkspaceComponent],
      providers: [
        {
          provide: WorkspaceService,
          useValue: {
            workspaces: signal([workspace]),
            current: signal(workspace),
            loading: signal(false),
            canAdminister,
            isOwner,
            load: () => of([workspace]),
            refresh: () => of([workspace]),
            switchTo: () => of(undefined),
          },
        },
        {provide: HttpService, useValue: http},
        {provide: NotificationService, useValue: notification},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows member Save only after access changes', () => {
    expect(memberSaveButtons().length).toBe(0);

    component.setMemberRole(operator, 'viewer');
    fixture.detectChanges();

    expect(memberSaveButtons().length).toBe(1);
    component.saveMember(operator);
    expect(http.updateWorkspaceMember).toHaveBeenCalledWith(workspace.id, operator.user_id, {
      role: 'viewer',
      billing_admin: false,
    });
  });

  it('keeps the sole owner removal disabled with the transfer tooltip', () => {
    expect(component.canRemoveMember(owner)).toBeFalse();
    expect(component.memberRemovalReason(owner)).toBe('Transfer ownership first');

    const button = fixture.nativeElement.querySelector('button[aria-label="Remove owner@example.test"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.disabled).toBeTrue();
  });

  it('renders plain member values for a read-only workspace role', () => {
    isOwner.set(false);
    canAdminister.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.invite-form')).toBeNull();
    expect(fixture.nativeElement.querySelector('.member-list select')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Operator');
  });

  it('creates a pending invitation and surfaces an unknown-account error inline', () => {
    const response: WorkspaceInvitationResponse = {
      invitation: {
        id: 8,
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        invitee_user_id: 9,
        invitee_email: 'member@example.test',
        inviter_user_id: owner.user_id,
        inviter_email: owner.email,
        role: 'operator',
        billing_admin: false,
        notification_status: 'not_configured',
        expires_at: '2026-09-02T00:00:00Z',
        created_at: '2026-08-26T00:00:00Z',
        updated_at: '2026-08-26T00:00:00Z',
      },
    };
    http.createWorkspaceInvitation.and.returnValue(of(response));
    component.inviteEmail = 'member@example.test';
    component.sendInvitation();

    expect(http.createWorkspaceInvitation).toHaveBeenCalledWith(workspace.id, {
      email: 'member@example.test',
      role: 'operator',
      billing_admin: false,
    });
    expect(component.invitations()).toEqual([response.invitation]);

    http.createWorkspaceInvitation.and.returnValue(throwError(() => ({error: {error: 'No Magpie account exists for that email address'}})));
    component.inviteEmail = 'missing@example.test';
    component.sendInvitation();
    fixture.detectChanges();

    expect(component.inviteError()).toBe('No Magpie account exists for that email address');
    expect(fixture.nativeElement.querySelector('.form-error').textContent).toContain('No Magpie account');
  });

  it('only shows member search for larger workspaces', () => {
    expect(component.showMemberSearch()).toBeFalse();
    component.members.set(Array.from({length: 9}, (_, index) => ({
      ...operator,
      user_id: index + 10,
      email: `member-${index}@example.test`,
    })));
    expect(component.showMemberSearch()).toBeTrue();
  });

  function memberSaveButtons(): HTMLButtonElement[] {
    const buttons = fixture.nativeElement.querySelectorAll('.member-list .button--compact') as NodeListOf<HTMLButtonElement>;
    return Array.from(buttons).filter(button => button.textContent?.trim().includes('Save'));
  }
});
