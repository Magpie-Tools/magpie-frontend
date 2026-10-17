import { ComponentFixture, TestBed } from '@angular/core/testing';

import {buildTopbarBreadcrumbs, TopbarComponent} from './topbar.component';
import {provideRouter, Router} from '@angular/router';
import {computed, signal} from '@angular/core';
import {OverlayContainer} from '@angular/cdk/overlay';
import {of, Subject, throwError} from 'rxjs';
import {WorkspaceService} from '../../services/workspace.service';
import {NotificationService} from '../../services/notification-service.service';
import {WorkspaceInvitationService} from '../../services/workspace-invitation.service';
import {AlertsService} from '../../services/alerts.service';
import {ReleaseFeed, ReleaseNote, UpdateNotificationService} from '../../services/update-notification.service';
import {AlertIncident, AlertsPage} from '../../models/Alert';
import {Workspace, WorkspaceInvitation} from '../../models/Workspace';

describe('TopbarComponent', () => {
  let component: TopbarComponent;
  let fixture: ComponentFixture<TopbarComponent>;
  let alerts: jasmine.SpyObj<AlertsService>;
  let updates: jasmine.SpyObj<UpdateNotificationService>;
  let current: ReturnType<typeof signal<Workspace | null>>;
  let invitations: ReturnType<typeof signal<WorkspaceInvitation[]>>;
  let overlay: OverlayContainer;
  const workspace = {id: 7, name: 'Production'} as Workspace;
  const invitation = {id: 1, workspace_name: 'Operations', inviter_email: 'owner@example.test', created_at: '2026-10-17T10:00:00Z'} as WorkspaceInvitation;
  const incident = {id: 2, rule_name: 'Minimum routes', scope_name: 'Production', opened_at: '2026-10-17T09:00:00Z'} as AlertIncident;
  const release = {id: 3, title: 'Faster checks', tagName: 'v2.4.0', publishedAt: '2026-10-17T08:00:00Z'} as ReleaseNote;
  const page: AlertsPage = {rules: [], destinations: [], incidents: [incident], deliveries: [], next_cursor: 0};
  const feed: ReleaseFeed = {releases: [release], newSinceLastSeen: [], lastSeenTag: 'v2.4.0', latestTag: 'v2.4.0', backendBuild: {buildVersion: 'dev', builtAt: 'unknown'}};

  beforeEach(async () => {
    spyOn(window, 'matchMedia').and.returnValue({matches: true} as MediaQueryList);
    current = signal<Workspace | null>(workspace);
    invitations = signal<WorkspaceInvitation[]>([invitation]);
    alerts = jasmine.createSpyObj<AlertsService>('AlertsService', ['load']);
    alerts.load.and.returnValue(of(page));
    updates = jasmine.createSpyObj<UpdateNotificationService>('UpdateNotificationService', ['fetchReleaseFeed']);
    updates.fetchReleaseFeed.and.returnValue(of(feed));
    await TestBed.configureTestingModule({
      imports: [TopbarComponent],
      providers: [
        provideRouter([
          {path: 'invitations', children: []},
          {path: 'alerts', children: []},
          {path: 'notifications', children: []},
        ]),
        {provide: AlertsService, useValue: alerts},
        {provide: UpdateNotificationService, useValue: updates},
        {
          provide: WorkspaceService,
          useValue: {
            workspaces: signal([workspace]),
            current,
            loading: signal(false),
            load: () => of([]),
            switchTo: () => of(undefined),
          },
        },
        {
          provide: WorkspaceInvitationService,
          useValue: {
            invitations,
            pendingCount: computed(() => invitations().length),
            loading: signal(false),
            error: signal(null),
            load: () => of([]),
          },
        },
        {provide: NotificationService, useValue: {showError: jasmine.createSpy('showError')}},
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TopbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    overlay = TestBed.inject(OverlayContainer);
  });

  async function openNotifications(): Promise<HTMLElement> {
    fixture.nativeElement.querySelector('.notifications-toggle').click();
    fixture.detectChanges();
    await fixture.whenStable();
    return overlay.getContainerElement().querySelector<HTMLElement>('.notification-panel')!;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(alerts.load).toHaveBeenCalledTimes(1);
  });

  it('opens a mixed feed and refreshes its sources when the bell is opened', async () => {
    const panel = await openNotifications();
    expect(panel).not.toBeNull();
    expect(Array.from(panel.querySelectorAll('.notification-item strong'), item => item.textContent?.trim()))
      .toEqual(['Join Operations', 'Minimum routes', 'Faster checks']);
    expect(updates.fetchReleaseFeed).toHaveBeenCalledTimes(2);
    expect(alerts.load).toHaveBeenCalledTimes(2);
    expect(panel.querySelector('.notification-item--invitation')?.getAttribute('href')).toBe('/invitations?invitation=1');
    expect(panel.querySelector('.notification-item--alert')?.getAttribute('href')).toBe('/alerts?section=history&incident=2');
    expect(panel.querySelector('.notification-item--release')?.getAttribute('href')).toBe('/notifications?release=3');
    expect(fixture.nativeElement.querySelector('.notifications-toggle').getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps the invitation inbox reachable when invitations are outside the latest five', async () => {
    const releases = Array.from({length: 6}, (_, index) => ({...release, id: 10 + index, publishedAt: `2026-10-18T0${index}:00:00Z`}));
    updates.fetchReleaseFeed.and.returnValue(of({...feed, releases}));
    const panel = await openNotifications();
    expect(panel.querySelectorAll('.notification-item').length).toBe(5);
    expect(panel.querySelector('.notification-item--invitation')).toBeNull();
    const inbox = panel.querySelector<HTMLAnchorElement>('.notification-panel__invitations')!;
    expect(inbox.textContent).toContain('1 pending');
    inbox.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/invitations');
    expect(component.notificationsState()).toBe('closed');
  });

  it('updates the feed when an invitation leaves the inbox', async () => {
    const panel = await openNotifications();
    invitations.set([]);
    fixture.detectChanges();
    expect(panel.querySelector('.notification-item--invitation')).toBeNull();
    expect(panel.querySelector('.notification-panel__pending')).toBeNull();
  });

  it('keeps working sources visible when alerts fail and allows retry', async () => {
    alerts.load.and.returnValue(throwError(() => new Error('unavailable')));
    const panel = await openNotifications();
    expect(panel.querySelector('.notification-panel__error')?.textContent).toContain('Could not load alerts.');
    expect(panel.querySelector('.notification-item--invitation')).not.toBeNull();
    expect(panel.querySelector('.notification-item--release')).not.toBeNull();
    alerts.load.and.returnValue(of(page));
    panel.querySelector<HTMLButtonElement>('.notification-panel__error button')!.click();
    fixture.detectChanges();
    expect(panel.querySelector('.notification-panel__error')).toBeNull();
  });

  it('discards old workspace requests and clears workspace alerts on reset', () => {
    const oldRequest = new Subject<AlertsPage>();
    alerts.load.and.returnValues(oldRequest, of({...page, incidents: []}));
    component.refreshNotifications();
    current.set({id: 9, name: 'Development'} as Workspace);
    fixture.detectChanges();
    oldRequest.next(page);
    expect(component.alertIncidents()).toEqual([]);
    current.set(null);
    fixture.detectChanges();
    expect(component.alertsLoading()).toBeFalse();
    expect(component.alertIncidents()).toEqual([]);
    expect(component.recentNotifications().map(item => item.kind)).toEqual(['invitation', 'release']);
  });

  it('shows the empty state while preserving the invitation inbox link', async () => {
    invitations.set([]);
    alerts.load.and.returnValue(of({...page, incidents: []}));
    updates.fetchReleaseFeed.and.returnValue(of({...feed, releases: []}));
    const panel = await openNotifications();
    expect(panel.textContent).toContain('No notifications yet');
    expect(panel.querySelector('.notification-panel__invitations')?.getAttribute('href')).toBe('/invitations');
  });

  it('shows loading without starting duplicate release requests', async () => {
    const request = new Subject<ReleaseFeed>();
    updates.fetchReleaseFeed.and.returnValue(request);
    component.refreshNotifications();
    const callCount = updates.fetchReleaseFeed.calls.count();
    await openNotifications();
    expect(component.notificationsLoading()).toBeTrue();
    expect(updates.fetchReleaseFeed).toHaveBeenCalledTimes(callCount);
    fixture.destroy();
    expect(request.observed).toBeFalse();
  });

  it('builds a singular proxy breadcrumb for detail routes', () => {
    expect(buildTopbarBreadcrumbs('/proxies/37530?sourceId=2')).toEqual([
      {label: 'Proxy', routerLink: '/proxies'},
      {label: '37530'},
    ]);
  });

  it('preserves every route layer and product casing', () => {
    expect(buildTopbarBreadcrumbs('/plugins/geolite')).toEqual([
      {label: 'Plugins', routerLink: '/plugins'},
      {label: 'GeoLite'},
    ]);

    expect(buildTopbarBreadcrumbs('/global/plugins/abuseipdb')).toEqual([
      {label: 'Global', routerLink: '/global'},
      {label: 'Plugins', routerLink: '/global/plugins'},
      {label: 'AbuseIPDB'},
    ]);
  });
});
