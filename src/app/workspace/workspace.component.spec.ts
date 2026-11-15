import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ApplicationRef, signal} from '@angular/core';
import {of, throwError} from 'rxjs';
import {
  Workspace,
  WorkspaceInvitationResponse,
  WorkspaceMember,
} from '../models/Workspace';
import {HttpService} from '../services/http.service';
import {NotificationService} from '../services/notification-service.service';
import {WorkspaceService} from '../services/workspace.service';
import {UserService} from '../services/authorization/user.service';
import {WORKSPACE_USAGE_MAX_AGE_MS, WorkspaceComponent} from './workspace.component';

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
    // Render with the console skin that index.html enables, so layout checks see the real styles.
    document.documentElement.setAttribute('data-ui', 'console');
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

  afterEach(() => {
    document.documentElement.removeAttribute('data-ui');
    // The schedule panel renders in the CDK overlay outside the fixture.
    document.querySelectorAll('.cdk-overlay-container').forEach(container => container.replaceChildren());
  });

  it('edits member access in the side panel and saves it', async () => {
    showMembers();
    const row = fixture.nativeElement.querySelector('button[aria-label="Change access for operator@example.test"]') as HTMLButtonElement;
    row.click();
    await settle();
    expect(component.panelMember()).toEqual(operator);
    const viewer = document.querySelector('.workspace-access-sheet input[name="member-role"][value="viewer"]') as HTMLInputElement;
    viewer.click();
    await settle();
    expect(component.isMemberDirty(operator)).toBeTrue();
    (document.querySelector('.workspace-access-sheet .access-save') as HTMLButtonElement).click();
    expect(http.updateWorkspaceMember).toHaveBeenCalledWith(workspace.id, operator.user_id, {
      role: 'viewer',
      billing_admin: false,
    });
    expect(component.accessPanel()).toBeNull();
  });
  it('docks the access panel to the right edge at full height', async () => {
    component.openMemberPanel(operator);
    await settle();
    await new Promise(resolve => setTimeout(resolve, 250));
    const sheet = document.querySelector('.workspace-access-sheet') as HTMLElement;
    const bounds = sheet.getBoundingClientRect();
    expect(bounds.width).toBeLessThan(document.documentElement.clientWidth);
    expect(Math.round(bounds.right)).toBe(document.documentElement.clientWidth);
    expect(Math.round(bounds.top)).toBe(0);
    expect(Math.round(bounds.height)).toBe(window.innerHeight);
    const avatar = sheet.querySelector('.access-head .avatar') as HTMLElement;
    expect(getComputedStyle(avatar).borderRadius).toBe('50%');
    expect(avatar.getBoundingClientRect().width).toBeGreaterThan(30);
  });

  it('drops unsaved access changes when the panel closes', () => {
    showMembers();
    component.openMemberPanel(operator);
    component.setMemberRole(operator, 'viewer');
    expect(component.isMemberDirty(operator)).toBeTrue();
    component.closeAccessPanel();
    expect(component.accessPanel()).toBeNull();
    expect(component.memberEdits[operator.user_id].role).toBe('operator');
  });

  it('asks before an ownership change and restores the picker when cancelled', () => {
    component.openMemberPanel(operator);
    component.setMemberRole(operator, 'owner');
    expect(component.ownershipChange()).toEqual({member: operator, role: 'owner'});
    const revision = component.rolePickerRevision();
    component.cancelOwnershipChange();
    expect(component.ownershipChange()).toBeNull();
    expect(component.rolePickerRevision()).toBe(revision + 1);
    expect(component.memberEdits[operator.user_id].role).toBe('operator');
  });
  it('keeps the sole owner removal disabled and says why', async () => {
    showMembers();
    expect(component.canRemoveMember(owner)).toBeFalse();
    expect(component.memberRemovalReason(owner)).toBe('Transfer ownership first');

    component.openMemberPanel(owner);
    await settle();
    const button = document.querySelector('.workspace-access-sheet button[aria-label="Remove owner@example.test"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.disabled).toBeTrue();
    expect(document.querySelector('.workspace-access-sheet .access-danger')?.textContent).toContain('Transfer ownership first');
  });
  it('renders members as plain rows for a read-only workspace role', () => {
    showMembers();
    isOwner.set(false);
    canAdminister.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.workspace-members .people-row--action')).toBeNull();
    expect(fixture.nativeElement.querySelector('.workspace-members .group-hint')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Operator');
    component.openMemberPanel(operator);
    expect(component.accessPanel()).toBeNull();
  });
  it('creates a pending invitation and surfaces an unknown-account error inline', async () => {
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
    component.startInvite();
    component.inviteEmail = 'member@example.test';
    component.sendInvitation();

    expect(http.createWorkspaceInvitation).toHaveBeenCalledWith(workspace.id, {
      email: 'member@example.test',
      role: 'operator',
      billing_admin: false,
    });
    expect(component.invitations()).toEqual([response.invitation]);
    expect(component.accessPanel()).toBeNull();
    expect(component.inviteEmail).toBe('');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[aria-label="Change invitation for member@example.test"]')).not.toBeNull();

    http.createWorkspaceInvitation.and.returnValue(throwError(() => ({error: {error: 'No Magpie account exists for that email address'}})));
    component.startInvite();
    component.inviteEmail = 'missing@example.test';
    component.sendInvitation();
    await settle();

    expect(component.inviteError()).toBe('No Magpie account exists for that email address');
    expect(component.accessPanel()).toEqual({kind: 'invite'});
    expect(document.querySelector('.workspace-access-sheet .form-error')?.textContent).toContain('No Magpie account');
  });

  it('always shows search and filters members and invitations by email', () => {
    showMembers();
    expect(fixture.nativeElement.querySelector('.workspace-members .search-field input')).not.toBeNull();
    component.memberSearch.set('OPERATOR@');
    expect(component.filteredMembers()).toEqual([operator]);
    expect(component.filteredInvitations()).toEqual([]);
  });

  it('runs member row dividers from card edge to card edge', () => {
    showMembers();
    expect(getComputedStyle(fixture.nativeElement.querySelector('.workspace-members .people-card')).paddingLeft).toBe('0px');
    const card = fixture.nativeElement.querySelector('.workspace-members .people-card') as HTMLElement;
    const row = card.querySelector('.people-row') as HTMLElement;
    const cardBounds = card.getBoundingClientRect();
    const rowBounds = row.getBoundingClientRect();
    expect(Math.round(rowBounds.left)).toBe(Math.round(cardBounds.left + 1));
    expect(Math.round(rowBounds.right)).toBe(Math.round(cardBounds.right - 1));
  });

  it('marks the signed-in member as you', () => {
    TestBed.inject(UserService).email.set('owner@example.test');
    expect(component.isCurrentUser(owner)).toBeTrue();
    expect(component.isCurrentUser(operator)).toBeFalse();
  });
  it('starts with capacity and keeps administration in separate sections', () => {
    expect(panel('overview').hidden).toBeFalse();
    expect(panel('members').hidden).toBeTrue();
    expect(panel('settings').hidden).toBeTrue();
    expect(panel('members').querySelector('.people-card')).not.toBeNull();
    const overview = panel('overview');
    expect(overview.querySelector('.workspace-strip')).not.toBeNull();
    expect(overview.querySelector('.forecast-card app-allowance-forecast-chart')).not.toBeNull();
    expect(overview.querySelector('.plan-card')).not.toBeNull();
    expect(overview.querySelector('.routes-card .route-bar')).not.toBeNull();
    // Interval editing lives in the schedule panel, not on the overview.
    expect(overview.querySelector('.cadence-editor')).toBeNull();
  });

  it('describes the plan, workspace type and role in the header without pills', () => {
    const meta = fixture.nativeElement.querySelector('.workspace-meta') as HTMLElement;
    expect(meta.textContent).toContain('Self-hosted plan');
    expect(meta.textContent).toContain('Shared');
    expect(meta.textContent).toContain('Owner');
    expect(meta.querySelector('.icon-users')).not.toBeNull();
  });

  it('opens the invitation panel on Members from the header', async () => {
    const invite = Array.from(fixture.nativeElement.querySelectorAll('.workspace-context__actions button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Invite member'))!;
    invite.click();
    await settle();
    expect(panel('members').hidden).toBeFalse();
    expect(component.accessPanel()).toEqual({kind: 'invite'});
    expect(document.querySelector('.workspace-access-sheet #workspace-invite-email')).not.toBeNull();
  });
  it('shows active, available and paused routes against the activation limit', () => {
    const bar = component.routeBar()!;
    expect(bar.active).toBe(750);
    expect(bar.available).toBe(250);
    expect(bar.paused).toBe(150);
    expect(bar.limitAt).toBeCloseTo((1000 / 1150) * 100, 5);
    expect(panel('overview').querySelector('.routes-card .status-chip')?.textContent).toContain('75% of limit');
  });

  it('projects allowance use from the stored cadence without recomputing it', () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date('2026-11-16T00:00:00Z'));
      const service = TestBed.inject(WorkspaceService);
      (service.current as ReturnType<typeof signal<Workspace | null>>).set({...workspace});
      const forecast = component.forecast()!;
      const [checks, scrapes] = forecast.series;
      expect(checks.used[1].percent).toBe(25);
      // 750 checks every 1.5 hours for the remaining 15 days is 180,000 more checks: 12% of 1.5M.
      expect(checks.projected[1].percent).toBeCloseTo(37, 5);
      expect(checks.runOutAt).toBeNull();
      // Used up: the line stays at 100% until the period ends.
      expect(scrapes.projected.every(point => point.percent === 100)).toBeTrue();
      expect(component.periodDaysLeft()).toBe(15);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('shows allowance usage and the derived cadence on the overview', () => {
    const [checks, scrapes] = component.allowanceMeters();
    expect(checks.percent).toBe(25);
    expect(checks.cadence).toBe('Each proxy is checked every 1.5 hours.');
    expect(scrapes.exhausted).toBeTrue();
    expect(scrapes.cadence).toContain('Allowance used. Scrapes resume on');
    expect(checks.schedule).toBe('Automatic · every 1.5 hours');
    expect(checks.outlook).toBe('Lasts the month');
    expect(scrapes.outlook).toContain('Used up · resumes');
    const strip = panel('overview').querySelector('.workspace-strip') as HTMLElement;
    expect(strip.querySelectorAll('.strip-bar[role="progressbar"]').length).toBe(3);
    expect(strip.textContent).toContain('375K');
    expect(component.forecast()?.series.length).toBe(2);
  });

  it('edits intervals in the schedule panel and keeps allowances for instance admins', async () => {
    component.openSchedule();
    fixture.detectChanges();
    await fixture.whenStable();
    const sheet = document.querySelector('.workspace-schedule-sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    expect(sheet.querySelectorAll('.schedule-block').length).toBe(2);
    // Only instance administrators may change a workspace's allowances.
    expect(sheet.querySelector('.allowance-admin')).toBeNull();

    component.cadenceDrafts.checks = {mode: 'fixed', value: 10, unit: 'minutes'};
    component.closeSchedule();
    expect(component.scheduleOpen()).toBeFalse();
    expect(component.cadenceDrafts.checks.mode).toBe('automatic');
  });

  it('only allows saving allowances after they change', () => {
    expect(component.allowancesChanged()).toBeFalse();
    component.allowanceChecks = 2_000_000;
    expect(component.allowancesChanged()).toBeTrue();
    component.allowanceChecks = null;
    expect(component.allowancesChanged()).toBeFalse();
    component.allowanceUnlimitedScrapes = true;
    expect(component.allowancesChanged()).toBeTrue();
  });

  it('warns while editing a fixed interval that needs more than the allowance', async () => {
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

    component.openSchedule();
    fixture.detectChanges();
    await fixture.whenStable();
    // Drive the panel like a user: choose Fixed, then every 5 minutes for scrapes.
    const scrapes = document.querySelectorAll('.workspace-schedule-sheet .schedule-block')[1] as HTMLElement;
    (Array.from(scrapes.querySelectorAll('.segmented button')) as HTMLButtonElement[])
      .find(button => button.textContent?.includes('Fixed'))!.click();
    await settle();
    const value = scrapes.querySelector('input[type="number"]') as HTMLInputElement;
    value.value = '5';
    value.dispatchEvent(new Event('input'));
    const unit = scrapes.querySelector('select') as HTMLSelectElement;
    unit.value = 'minutes';
    unit.dispatchEvent(new Event('change'));
    await settle();
    expect(component.cadenceError('scrapes')).toContain('15 minutes');
    expect(scrapes.querySelector('.inline-error')?.textContent).toContain('15 minutes');
    expect(document.querySelector('.workspace-schedule-sheet .cadence-save')?.hasAttribute('disabled')).toBeTrue();
  });

  it('saves fixed intervals and surfaces server warnings', () => {
    http.updateWorkspaceCadence.and.returnValue(of({
      check_interval_seconds: 600,
      scrape_interval_seconds: 0,
      warnings: ['This interval needs about 3240000 checks a month'],
    }));
    component.openSchedule();
    component.cadenceDrafts.checks = {mode: 'fixed', value: 10, unit: 'minutes'};
    component.saveCadence();
    expect(http.updateWorkspaceCadence).toHaveBeenCalledWith({check_interval_seconds: 600, scrape_interval_seconds: 0});
    expect(notification.showWarn).toHaveBeenCalledWith('This interval needs about 3240000 checks a month');
    expect(component.scheduleOpen()).toBeFalse();
  });

  it('requires a fixed interval for a workspace without a monthly limit', async () => {
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
    const cell = panel('overview').querySelector('.strip-cell') as HTMLElement;
    expect(cell.querySelector('.strip-bar')).toBeNull();
    // Only metrics with a monthly limit are forecast.
    expect(component.forecast()?.series.map(series => series.id)).toEqual(['scrapes']);
    expect(panel('overview').querySelector('.forecast-card .allowance-warning')?.textContent).toContain('Until you choose an interval');
    component.openSchedule();
    fixture.detectChanges();
    await fixture.whenStable();
    const block = document.querySelector('.workspace-schedule-sheet .schedule-block') as HTMLElement;
    expect(block.querySelector('.allowance-tag--unlimited')?.textContent).toContain('No limit');
    const automatic = Array.from(block.querySelectorAll('.segmented button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Automatic'))!;
    expect(automatic.disabled).toBeTrue();
    // No allowance, so no over-allowance warning even at the fastest interval.
    component.cadenceDrafts.checks = {mode: 'fixed', value: 1, unit: 'minutes'};
    expect(component.cadenceWarning('checks')).toBeNull();
    component.cadenceDrafts.checks = {mode: 'automatic', value: 1, unit: 'hours'};
    expect(component.cadenceError('checks')).toContain('choose a fixed interval');

  });

  it('reloads usage in the background without discarding interval drafts', () => {
    jasmine.clock().install();
    try {
      const service = TestBed.inject(WorkspaceService);
      const load = spyOn(service, 'load').and.returnValue(of([workspace]));
      const background = TestBed.createComponent(WorkspaceComponent);
      background.detectChanges();
      background.componentInstance.cadenceDrafts.checks = {mode: 'fixed', value: 10, unit: 'minutes'};
      load.calls.reset();

      jasmine.clock().tick(WORKSPACE_USAGE_MAX_AGE_MS);
      expect(load).toHaveBeenCalledOnceWith(false, WORKSPACE_USAGE_MAX_AGE_MS);
      expect(background.componentInstance.cadenceDrafts.checks).toEqual({mode: 'fixed', value: 10, unit: 'minutes'});

      background.destroy();
      jasmine.clock().tick(WORKSPACE_USAGE_MAX_AGE_MS);
      expect(load).toHaveBeenCalledTimes(1);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('keeps the workspace tab strip at the compact global-tab height', () => {
    const list = fixture.nativeElement.querySelector('[role="tablist"]') as HTMLElement;
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(list.getBoundingClientRect().height).toBeGreaterThan(0);
    // Phone and touch layouts raise every trigger to a 44px target; the list adds 3px padding and a border.
    const touch = matchMedia('(pointer: coarse), (max-width: 48rem)').matches;
    const limit = touch ? 2.75 * rootFontSize + 8 : 2.25 * rootFontSize;
    expect(list.getBoundingClientRect().height).toBeLessThanOrEqual(limit + 0.5);
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

  it('lists pending invitations and opens them in the panel', async () => {
    const invitation = {
      id: 5, workspace_id: workspace.id, workspace_name: workspace.name, invitee_user_id: 9,
      invitee_email: 'pending@example.test', inviter_user_id: owner.user_id, inviter_email: owner.email,
      role: 'viewer' as const, billing_admin: false, notification_status: 'failed' as const,
      expires_at: '2026-11-20T00:00:00Z', created_at: '2026-11-13T00:00:00Z', updated_at: '2026-11-13T00:00:00Z',
    };
    component.invitations.set([invitation]);
    component.invitationEdits[invitation.id] = {role: 'viewer', billing_admin: false};
    showMembers();
    const row = fixture.nativeElement.querySelector('button[aria-label="Change invitation for pending@example.test"]') as HTMLButtonElement;
    expect(row.textContent).toContain('Email not sent');
    row.click();
    await settle();
    expect(component.panelInvitation()).toEqual(invitation);
    expect(document.querySelector('.workspace-access-sheet button[aria-label="Revoke invitation for pending@example.test"]')).not.toBeNull();
  });
  it('keeps an invitation draft when the panel is closed and reopened', () => {
    component.startInvite();
    component.inviteEmail = 'draft@example.test';
    component.closeAccessPanel();
    expect(component.accessPanel()).toBeNull();
    component.startInvite();
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

  /** Runs change detection for the fixture and the overlay views attached to the application. */
  async function settle(): Promise<void> {
    TestBed.inject(ApplicationRef).tick();
    await fixture.whenStable();
  }

  function panel(section: string): HTMLElement {
    return fixture.nativeElement.querySelector('#brn-tabs-content-workspace-' + section);
  }

  function showMembers(): void {
    fixture.nativeElement.querySelector('#brn-tabs-label-workspace-members').click();
    fixture.detectChanges();
  }

});
