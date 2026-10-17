import {computed, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter, Router} from '@angular/router';
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
  let loading: ReturnType<typeof signal<boolean>>;
  let error: ReturnType<typeof signal<string | null>>;
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
    loading = signal(false);
    error = signal<string | null>(null);
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
            loading,
            error,
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

  it('scrolls to and highlights the linked invitation without accepting or declining it', async () => {
    spyOn(window, 'matchMedia').and.returnValue({matches: true} as MediaQueryList);
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    const router = TestBed.inject(Router);
    pending.set([{...invitation, id: 5, workspace_name: 'Operations'}, invitation]);
    await router.navigateByUrl('/?invitation=4');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const target = fixture.nativeElement.querySelector('#workspace-invitation-4') as HTMLElement;
    expect(scroll).toHaveBeenCalledOnceWith({behavior: 'auto', block: 'center', inline: 'nearest'});
    expect(scroll.calls.mostRecent().object).toBe(target);
    expect(document.activeElement).toBe(target);
    expect(target.classList).toContain('invitation-row--highlighted');
    expect(fixture.nativeElement.querySelector('#workspace-invitation-5').classList).not.toContain('invitation-row--highlighted');
    expect(router.url).toBe('/');
    expect(accept).not.toHaveBeenCalled();
    expect(decline).not.toHaveBeenCalled();
    expect(switchTo).not.toHaveBeenCalled();
  });

  it('waits for a successful invitation load before focusing the target', async () => {
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    loading.set(true);
    pending.set([]);
    await TestBed.inject(Router).navigateByUrl('/?invitation=4');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scroll).not.toHaveBeenCalled();
    pending.set([invitation]);
    error.set('Temporarily unavailable');
    loading.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scroll).not.toHaveBeenCalled();

    error.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scroll.calls.mostRecent().object).toBe(fixture.nativeElement.querySelector('#workspace-invitation-4'));
    expect(component.highlightedInvitationId()).toBe(4);
  });

  it('replays a repeated notification and clears the highlight when its invitation leaves the inbox', async () => {
    spyOn(window, 'matchMedia').and.returnValue({matches: false} as MediaQueryList);
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    const router = TestBed.inject(Router);
    for (let click = 0; click < 2; click++) {
      await router.navigateByUrl('/?invitation=4');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.highlightedInvitationId()).toBe(4);
      expect(scroll.calls.count()).toBe(click + 1);
    }
    expect(scroll).toHaveBeenCalledWith(jasmine.objectContaining({behavior: 'smooth'}));
    pending.set([invitation, {...invitation, id: 5}]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scroll.calls.count()).toBe(2);
    pending.set([{...invitation, id: 5}]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.highlightedInvitationId()).toBeNull();
    expect(scroll.calls.count()).toBe(2);
  });

  it('ignores invalid, accepted, declined, or expired invitation targets', async () => {
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    const router = TestBed.inject(Router);
    for (const id of ['invalid', '-1', '0', '1.5', '9007199254740992', '9']) {
      await router.navigateByUrl('/?invitation=' + id);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.highlightedInvitationId()).toBeNull();
    }
    expect(scroll).not.toHaveBeenCalled();
    expect(accept).not.toHaveBeenCalled();
    expect(decline).not.toHaveBeenCalled();
  });

  it('cancels a pending jump when the invitation link is removed', async () => {
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    loading.set(true);
    pending.set([]);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?invitation=4');
    fixture.detectChanges();
    await fixture.whenStable();
    await router.navigateByUrl('/');
    pending.set([invitation]);
    loading.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scroll).not.toHaveBeenCalled();
    expect(component.highlightedInvitationId()).toBeNull();
  });
});
