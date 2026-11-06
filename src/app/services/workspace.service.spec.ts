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
      monthly_checks: 0,
      monthly_scrapes: 0,
      unlimited_checks: false,
      unlimited_scrapes: false,
      cancel_at_period_end: false,
    },
    allowances: {
      unlimited_checks: false,
      unlimited_scrapes: false,
      needs_check_interval: false,
      needs_scrape_interval: false,
      monthly_checks: 50000,
      used_checks: 0,
      checks_per_cycle: 0,
      check_interval_seconds: 60,
      checks_exhausted: false,
      monthly_scrapes: 3000,
      used_scrapes: 0,
      scrapes_per_cycle: 0,
      scrape_interval_seconds: 900,
      scrapes_exhausted: false,
      requested_check_interval_seconds: 0,
      requested_scrape_interval_seconds: 0,
      minimum_check_interval_seconds: 60,
      minimum_scrape_interval_seconds: 900,
      projected_monthly_checks: 0,
      projected_monthly_scrapes: 0,
      inherits_checks: true,
      inherits_scrapes: true,
      period_start: '2026-11-01T00:00:00Z',
      period_end: '2026-12-01T00:00:00Z',
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
