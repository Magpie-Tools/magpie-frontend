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
      monthly_checks: 1500000,
      used_checks: 375000,
      checks_per_cycle: 750,
      check_interval_seconds: 5400,
      checks_exhausted: false,
      monthly_scrapes: 3000,
      used_scrapes: 3000,
      scrapes_per_cycle: 4,
      scrape_interval_seconds: 0,
      scrapes_exhausted: true,
      requested_check_interval_seconds: 0,
      requested_scrape_interval_seconds: 0,
      minimum_check_interval_seconds: 60,
      minimum_scrape_interval_seconds: 900,
      projected_monthly_checks: 1500000,
      projected_monthly_scrapes: 0,
      inherits_checks: true,
      inherits_scrapes: true,
      period_start: '2026-11-01T00:00:00Z',
      period_end: '2026-12-01T00:00:00Z',
      computed_at: '2026-11-12T08:00:00Z',
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
      'updateWorkspaceCadence',
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
            canOperate: signal(true),
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
    showMembers();
    expect(memberSaveButtons().length).toBe(0);

    component.setMemberRole(operator, 'viewer');
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    expect(memberSaveButtons().length).toBe(1);
    component.saveMember(operator);
    expect(http.updateWorkspaceMember).toHaveBeenCalledWith(workspace.id, operator.user_id, {
      role: 'viewer',
      billing_admin: false,
    });
  });

  it('keeps the sole owner removal disabled with the transfer tooltip', () => {
    showMembers();
    expect(component.canRemoveMember(owner)).toBeFalse();
    expect(component.memberRemovalReason(owner)).toBe('Transfer ownership first');

    const button = fixture.nativeElement.querySelector('button[aria-label="Remove owner@example.test"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.disabled).toBeTrue();
  });

  it('renders plain member values for a read-only workspace role', () => {
    showMembers();
    isOwner.set(false);
    canAdminister.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.invite-form')).toBeNull();
    expect(fixture.nativeElement.querySelector('.member-list select')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Operator');
  });

  it('creates a pending invitation and surfaces an unknown-account error inline', () => {
    showMembers();
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
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.invite-form')).not.toBeNull();
    expect(component.inviteEmail).toBe('');

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

  it('starts with capacity and keeps administration in separate sections', () => {
    expect(panel('overview').hidden).toBeFalse();
    expect(panel('members').hidden).toBeTrue();
    expect(panel('settings').hidden).toBeTrue();
    expect(panel('members').querySelector('.invite-form')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.plan-accordions details[open]').length).toBe(0);
  });

  it('shows allowance usage and the derived cadence on the overview', () => {
    const [checks, scrapes] = component.allowanceMeters();
    expect(checks.percent).toBe(25);
    expect(checks.cadence).toBe('Each proxy is checked every 1.5 hours.');
    expect(scrapes.exhausted).toBeTrue();
    expect(scrapes.cadence).toContain('Allowance used. Scrapes resume on');
    const card = panel('overview').querySelector('.allowance-card') as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.querySelectorAll('.allowance-meter').length).toBe(2);
    // Only instance administrators may change a workspace's allowances.
    expect(card.querySelector('.allowance-admin')).toBeNull();
  });

  it('warns while editing a fixed interval that needs more than the allowance', () => {
    expect(component.cadenceDrafts.checks.mode).toBe('automatic');
    expect(component.cadenceWarning('checks')).toBeNull();

    // 750 checks per cycle every 10 minutes is about 3.24M checks a month.
    component.cadenceDrafts.checks = {mode: 'fixed', value: 10, unit: 'minutes'};
    expect(component.cadenceError('checks')).toBeNull();
    expect(component.cadenceWarning('checks')).toContain('more than the allowance of 1,500,000');
    expect(component.cadenceWarning('checks')).toContain('Checks stop when the allowance is used up.');

    // Every 2 hours fits: about 270,000 checks a month.
    component.cadenceDrafts.checks = {mode: 'fixed', value: 2, unit: 'hours'};
    expect(component.cadenceWarning('checks')).toBeNull();

    component.cadenceDrafts.checks = {mode: 'fixed', value: 30, unit: 'minutes'};
    component.cadenceDrafts.scrapes = {mode: 'fixed', value: 5, unit: 'minutes'};
    expect(component.cadenceError('scrapes')).toContain('15 minutes');
    fixture.detectChanges();
    expect(panel('overview').querySelector('.cadence-actions button')?.hasAttribute('disabled')).toBeTrue();
  });

  it('saves fixed intervals and surfaces server warnings', () => {
    http.updateWorkspaceCadence.and.returnValue(of({
      check_interval_seconds: 600,
      scrape_interval_seconds: 0,
      warnings: ['This interval needs about 3240000 checks a month'],
    }));
    component.cadenceDrafts.checks = {mode: 'fixed', value: 10, unit: 'minutes'};
    component.saveCadence();
    expect(http.updateWorkspaceCadence).toHaveBeenCalledWith({check_interval_seconds: 600, scrape_interval_seconds: 0});
    expect(notification.showWarn).toHaveBeenCalledWith('This interval needs about 3240000 checks a month');
  });

  it('requires a fixed interval for a workspace without a monthly limit', () => {
    const service = TestBed.inject(WorkspaceService);
    (service.current as ReturnType<typeof signal<Workspace | null>>).set({
      ...workspace,
      subscription: {...workspace.subscription, unlimited_checks: true},
      allowances: {
        ...workspace.allowances,
        unlimited_checks: true,
        needs_check_interval: true,
        inherits_checks: false,
        used_checks: 90_000_000,
        check_interval_seconds: 3600,
      },
    });
    component.syncCurrentWorkspace();
    fixture.detectChanges();

    const [checks] = component.allowanceMeters();
    expect(checks.unlimited).toBeTrue();
    expect(checks.runOutWarning).toBeNull();
    expect(checks.cadence).toBe('No monthly limit. Until you choose an interval, each proxy is checked every hour.');
    // The editor starts on the hourly interval and offers to save it.
    expect(component.cadenceDrafts.checks).toEqual({mode: 'fixed', value: 1, unit: 'hours'});
    expect(component.cadenceChanged()).toBeTrue();
    const meter = panel('overview').querySelector('.allowance-meter') as HTMLElement;
    expect(meter.querySelector('.capacity-progress')).toBeNull();
    expect(meter.querySelector('.allowance-tag--unlimited')?.textContent).toContain('No limit');
    expect((meter.querySelector('option[value="automatic"]') as HTMLOptionElement).disabled).toBeTrue();
    // No allowance, so no over-allowance warning even at the fastest interval.
    component.cadenceDrafts.checks = {mode: 'fixed', value: 1, unit: 'minutes'};
    expect(component.cadenceWarning('checks')).toBeNull();
    component.cadenceDrafts.checks = {mode: 'automatic', value: 1, unit: 'hours'};
    expect(component.cadenceError('checks')).toContain('choose a fixed interval');

  });

  it('keeps the workspace tab strip at the compact global-tab height', () => {
    const list = fixture.nativeElement.querySelector('[role="tablist"]') as HTMLElement;
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(list.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(list.getBoundingClientRect().height).toBeLessThanOrEqual(2.25 * rootFontSize + 0.5);
  });

  it('supports keyboard selection and links each tab to its panel', async () => {
    const overview = fixture.nativeElement.querySelector('#brn-tabs-label-workspace-overview') as HTMLButtonElement;
    overview.focus();
    overview.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', keyCode: 39, bubbles: true}));
    await fixture.whenStable();
    fixture.detectChanges();
    const members = fixture.nativeElement.querySelector('#brn-tabs-label-workspace-members') as HTMLButtonElement;
    expect(members.getAttribute('aria-selected')).toBe('true');
    expect(members.getAttribute('aria-controls')).toBe(panel('members').id);
    expect(panel('members').hidden).toBeFalse();
    expect(panel('overview').hidden).toBeTrue();
  });

  it('preserves unsaved member access when navigating between sections', () => {
    showMembers();
    component.setMemberRole(operator, 'viewer');
    fixture.nativeElement.querySelector('#brn-tabs-label-workspace-overview').click();
    fixture.detectChanges();
    expect(panel('members').hidden).toBeTrue();
    showMembers();
    expect(component.memberEdits[operator.user_id].role).toBe('viewer');
    expect(memberSaveButtons().length).toBe(1);
  });

  it('keeps invitations open in Members and preserves a draft between sections', () => {
    showMembers();
    expect(panel('members').hidden).toBeFalse();
    expect(fixture.nativeElement.querySelector('.invite-form')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.workspace-context button')).toBeNull();
    expect(fixture.nativeElement.querySelector('.invite-cancel')).toBeNull();
    component.inviteEmail = 'draft@example.test';
    fixture.nativeElement.querySelector('#brn-tabs-label-workspace-overview').click();
    fixture.detectChanges();
    expect(panel('members').hidden).toBeTrue();
    showMembers();
    expect(fixture.nativeElement.querySelector('.invite-form')).not.toBeNull();
    expect(http.createWorkspaceInvitation).not.toHaveBeenCalled();
    expect(component.inviteEmail).toBe('draft@example.test');
  });

  it('keeps rename and creation available in Settings for administrators', () => {
    fixture.nativeElement.querySelector('#brn-tabs-label-workspace-settings').click();
    fixture.detectChanges();
    expect(panel('settings').hidden).toBeFalse();
    expect(fixture.nativeElement.querySelector('#workspace-name')).not.toBeNull();
    fixture.nativeElement.querySelector('.create-card .disclosure').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#new-workspace-name')).not.toBeNull();
  });

  function panel(section: string): HTMLElement {
    return fixture.nativeElement.querySelector('#brn-tabs-content-workspace-' + section);
  }

  function showMembers(): void {
    fixture.nativeElement.querySelector('#brn-tabs-label-workspace-members').click();
    fixture.detectChanges();
  }

  function memberSaveButtons(): HTMLButtonElement[] {
    const buttons = fixture.nativeElement.querySelectorAll('.member-list .button--compact') as NodeListOf<HTMLButtonElement>;
    return Array.from(buttons).filter(button => button.textContent?.trim().includes('Save'));
  }
});
