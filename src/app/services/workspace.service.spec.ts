import {TestBed} from '@angular/core/testing';
import {Subject, of} from 'rxjs';
import {Workspace} from '../models/Workspace';
import {HttpService} from './http.service';
import {WorkspaceInvitationService} from './workspace-invitation.service';
import {WorkspaceService} from './workspace.service';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let getWorkspaces: jasmine.Spy;

  const workspace = (id: number, name: string, isDefault = true): Workspace => ({
    id,
    name,
    personal: true,
    role: 'owner',
    billing_admin: true,
    is_default: isDefault,
    capacity: {
      active_routes: 0,
      stored_routes: 0,
      included_routes: 0,
      additional_routes: 0,
      overage_routes: 0,
      activation_limit: null,
      overage_mode: 'unlimited',
    },
    subscription: {
      plan_code: 'free',
      status: 'active',
      included_operators: 1,
      statistics_retention_days: 7,
      minimum_check_interval_seconds: 60,
      cancel_at_period_end: false,
    },
    created_at: '2026-08-25T00:00:00Z',
  });

  beforeEach(() => {
    window.localStorage.removeItem('magpie-workspace-id');
    getWorkspaces = jasmine.createSpy('getWorkspaces');

    TestBed.configureTestingModule({
      providers: [
        WorkspaceService,
        {
          provide: HttpService,
          useValue: {getWorkspaces},
        },
        {
          provide: WorkspaceInvitationService,
          useValue: {reset: jasmine.createSpy('resetInvitations')},
        },
      ],
    });

    service = TestBed.inject(WorkspaceService);
  });

  afterEach(() => {
    window.localStorage.removeItem('magpie-workspace-id');
  });

  it('loads the new account workspaces after the session is reset', () => {
    const firstAccount = workspace(1, 'First account');
    const secondAccount = workspace(2, 'Second account');
    getWorkspaces.and.returnValues(of([firstAccount]), of([secondAccount]));

    service.load().subscribe();

    expect(service.current()).toEqual(firstAccount);
    expect(window.localStorage.getItem('magpie-workspace-id')).toBe('1');

    service.reset();

    expect(service.workspaces()).toEqual([]);
    expect(service.current()).toBeNull();
    expect(window.localStorage.getItem('magpie-workspace-id')).toBeNull();

    service.load().subscribe();

    expect(getWorkspaces).toHaveBeenCalledTimes(2);
    expect(service.workspaces()).toEqual([secondAccount]);
    expect(service.current()).toEqual(secondAccount);
    expect(window.localStorage.getItem('magpie-workspace-id')).toBe('2');
  });

  it('does not restore workspace state from an old in-flight request', () => {
    const oldRequest = new Subject<Workspace[]>();
    const secondAccount = workspace(2, 'Second account');
    getWorkspaces.and.returnValues(oldRequest, of([secondAccount]));

    service.load().subscribe();
    service.reset();
    service.load().subscribe();
    oldRequest.next([workspace(1, 'First account')]);
    oldRequest.complete();

    expect(service.workspaces()).toEqual([secondAccount]);
    expect(service.current()).toEqual(secondAccount);
    expect(service.loading()).toBeFalse();
  });
});
