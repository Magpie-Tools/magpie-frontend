import { ComponentFixture, TestBed } from '@angular/core/testing';
import {Component} from '@angular/core';
import {provideRouter} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import { of, Subject } from 'rxjs';

import { DASHBOARD_REREQUEST_WINDOW_MS, DashboardComponent } from './dashboard.component';
import { DashboardQueryData, GraphqlService } from '../services/graphql.service';

@Component({template: '<h1>Other page</h1>'})
class OtherPageComponent {}

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let graphqlService: jasmine.SpyObj<GraphqlService>;
  let dashboardData: DashboardQueryData;

  beforeEach(async () => {
    graphqlService = jasmine.createSpyObj<GraphqlService>('GraphqlService', ['fetchDashboardData']);
    dashboardData = {
      viewer: {
        dashboardView: {
          status: 'FRESH',
          rebuilding: false,
          healthMasked: false,
          collectedAt: new Date().toISOString(),
          computedAt: new Date().toISOString(),
          info: {
            totalChecks: 0,
            checksThisMonth: 0,
            totalScraped: 0,
            reputationBreakdown: {good: 0, neutral: 0, poor: 0, unknown: 0},
            countryBreakdown: [],
            judgeValidProxies: []
          },
          recentProxyChecks: [],
          fastestAliveProxies: [],
          aliveCount: 0,
          proxyCount: 0
        },
        proxyLimit: null,
        proxyHistory: [],
        proxySnapshots: {alive: [], scraped: []},
        scrapeSourceCount: 0
      }
    };
    graphqlService.fetchDashboardData.and.returnValue(of(dashboardData));

    await TestBed.configureTestingModule({
      animationsEnabled: true,
      imports: [DashboardComponent],
      providers: [
        {provide: GraphqlService, useValue: graphqlService},
        provideRouter([
          {path: 'dashboard', component: DashboardComponent},
          {path: 'other', component: OtherPageComponent},
        ]),
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows fallback metric values without inventing trend history', () => {
    dashboardData.viewer.dashboardView.proxyCount = 400;
    dashboardData.viewer.dashboardView.aliveCount = 50;
    dashboardData.viewer.dashboardView.info.totalScraped = 250;

    component.onProxyHistoryRefresh();
    fixture.detectChanges();

    const cards: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('app-kpi-card');
    expect(Array.from(cards, card => card.querySelector('.metric-card__value')?.textContent?.trim())).toEqual(['50', '400', '250']);
    expect(fixture.nativeElement.querySelectorAll('.metric-card__trend').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('app-kpi-card app-chart').length).toBe(0);
  });

  it('shows KPI trends only after real prior samples arrive', () => {
    const previousTime = '2026-10-16T10:00:00Z';
    const currentTime = '2026-10-16T11:00:00Z';
    dashboardData.viewer.dashboardView.proxyCount = 40;
    dashboardData.viewer.proxySnapshots = {
      alive: [{count: 12, recordedAt: currentTime}],
      scraped: [{count: 24, recordedAt: currentTime}]
    };

    component.onProxyHistoryRefresh();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.metric-card__trend').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('app-kpi-card app-chart').length).toBe(0);

    dashboardData.viewer.proxySnapshots.alive.unshift({count: 10, recordedAt: previousTime});
    dashboardData.viewer.proxySnapshots.scraped.unshift({count: 20, recordedAt: previousTime});
    dashboardData.viewer.proxyHistory = [{count: 30, recordedAt: previousTime}];
    component.onProxyHistoryRefresh();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.metric-card__trend').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('app-kpi-card app-chart').length).toBe(3);
  });

  it('swaps the skeleton for content when dashboard data arrives', async () => {
    fixture.destroy();
    const request = new Subject<DashboardQueryData>();
    graphqlService.fetchDashboardData.and.returnValue(request);
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    const stage: HTMLElement = fixture.nativeElement.querySelector('.loading-stage');
    const skeleton: HTMLElement = fixture.nativeElement.querySelector('.dashboard-skeleton');
    expect(skeleton).not.toBeNull();

    request.next(dashboardData);
    request.complete();
    fixture.detectChanges();
    await fixture.whenStable();

    const content: HTMLElement = fixture.nativeElement.querySelector('.loading-stage__content');
    expect(fixture.nativeElement.querySelector('.loading-stage')).toBe(stage);
    expect(content.querySelector('app-kpi-card')).not.toBeNull();
    expect(content.style.transform).toBe('');
    expect(getComputedStyle(skeleton).position).toBe('absolute');
    expect(skeleton.classList).toContain('loading-stage__leave');
    expect(content.classList).toContain('loading-stage__enter');

    await Promise.all([...content.getAnimations(), ...skeleton.getAnimations()].map(animation => animation.finished));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(fixture.nativeElement.querySelector('.dashboard-skeleton')).toBeNull();
  });

  it('keeps the settled content visible during a history refresh', async () => {
    await fixture.whenStable();
    const stage = fixture.nativeElement.querySelector('.loading-stage');
    const content: HTMLElement = fixture.nativeElement.querySelector('.loading-stage__content');
    await Promise.all(content.getAnimations().map(animation => animation.finished));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    const request = new Subject<DashboardQueryData>();
    graphqlService.fetchDashboardData.and.returnValue(request);
    component.onProxyHistoryRefresh();
    fixture.detectChanges();
    request.next(dashboardData);
    request.complete();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.loading-stage')).toBe(stage);
    expect(fixture.nativeElement.querySelector('.loading-stage__content')).toBe(content);
    expect(content.getAnimations()).toEqual([]);
    expect(fixture.nativeElement.querySelector('.dashboard-skeleton')).toBeNull();
  });

  it('clears the loading page when navigating away', async () => {
    fixture.destroy();
    const request = new Subject<DashboardQueryData>();
    graphqlService.fetchDashboardData.and.returnValue(request);
    const harness = await RouterTestingHarness.create('/dashboard');
    const host: HTMLElement = harness.fixture.nativeElement;
    const header: HTMLElement = host.querySelector('.dashboard-context')!;
    expect(header).not.toBeNull();
    expect(host.querySelector('.dashboard-skeleton')).not.toBeNull();

    await harness.navigateByUrl('/other', OtherPageComponent);

    expect(host.querySelector('.dashboard-context')).toBeNull();
    expect(host.querySelector('.dashboard-skeleton')).toBeNull();
    expect(host.textContent).toContain('Other page');
    expect(request.observed).toBeFalse();
  });

  it('keeps one dashboard header through errors and retries', () => {
    const header = fixture.nativeElement.querySelector('.dashboard-context');
    component.dashboardInfo.set({loading: false, loaded: false, error: 'Connection failed', backendUnavailable: true});
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.dashboard-context')).toBe(header);
    expect(fixture.nativeElement.querySelectorAll('h1').length).toBe(1);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Backend unavailable');

    const retry = spyOn(component, 'retryDashboardLoad');
    fixture.nativeElement.querySelector('app-page-load-error button').click();
    expect(retry).toHaveBeenCalledTimes(1);

    component.dashboardInfo.set({loading: true, loaded: false});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dashboard-context')).toBe(header);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('should aggregate duplicate unknown country buckets', () => {
    (component as any).updateCountryBreakdown([
      {country: 'Unknown', count: 10},
      {country: 'N/A', count: 5},
      {country: 'unk', count: 3},
      {country: '', count: 2},
      {country: 'Germany', count: 20}
    ]);

    expect(component.majorCountries()).toEqual([
      {name: 'Unknown', value: 20, percentage: '50.0'},
      {name: 'Germany', value: 20, percentage: '50.0'}
    ]);
  });

  it('shows absent snapshot parts as a dash, never as zero', () => {
    const view = dashboardData.viewer.dashboardView;
    view.status = 'PENDING';
    view.rebuilding = true;
    view.collectedAt = null;
    view.computedAt = null;
    view.aliveCount = null;
    view.proxyCount = null;
    view.recentProxyChecks = null;
    view.fastestAliveProxies = null;
    view.info = {totalChecks: 1200, checksThisMonth: 34, totalScraped: null, reputationBreakdown: null, countryBreakdown: null, judgeValidProxies: null};

    component.onProxyHistoryRefresh();
    fixture.detectChanges();

    const cards: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('app-kpi-card');
    expect(Array.from(cards, card => card.querySelector('.metric-card__value')?.textContent?.trim())).toEqual(['—', '—', '—']);
    const status: HTMLElement = fixture.nativeElement.querySelector('.dashboard-context__status');
    expect(status.textContent).toContain('Updating');
    // The live check figures are shown even before a snapshot exists.
    const checks: HTMLElement = fixture.nativeElement.querySelector('.dashboard-context__checks');
    expect(checks.textContent).toContain('34');
    expect(checks.textContent).toContain('1,200');
  });

  it('never shows an earlier alive sample while health is masked', () => {
    const view = dashboardData.viewer.dashboardView;
    view.healthMasked = true;
    view.aliveCount = null;
    dashboardData.viewer.proxySnapshots = {
      alive: [{count: 700, recordedAt: '2026-10-16T10:00:00Z'}, {count: 800, recordedAt: '2026-10-16T11:00:00Z'}],
      scraped: []
    };

    component.onProxyHistoryRefresh();
    fixture.detectChanges();

    const alive: HTMLElement = fixture.nativeElement.querySelector('app-kpi-card .metric-card__value');
    expect(alive.textContent?.trim()).toBe('—');
  });

  it('shows the reputation breakdown as unavailable, not as zeros', () => {
    dashboardData.viewer.dashboardView.info.reputationBreakdown = null;
    component.onProxyHistoryRefresh();
    fixture.detectChanges();

    const card: HTMLElement = fixture.nativeElement.querySelector('app-proxy-reputation-card');
    expect(card.textContent).toContain('Reputation data is not available yet.');
    expect(card.querySelectorAll('.reputation-card__legend').length).toBe(0);
  });

  it('labels stale and failed snapshots with their age', () => {
    const view = dashboardData.viewer.dashboardView;
    view.status = 'STALE';
    view.collectedAt = new Date(Date.now() - 5 * 60_000).toISOString();
    component.onProxyHistoryRefresh();
    fixture.detectChanges();
    const status = () => (fixture.nativeElement.querySelector('.dashboard-context__status') as HTMLElement).textContent ?? '';
    expect(status()).toContain('Not current');
    expect(status()).toContain('Updated 5 min ago');

    view.status = 'FAILED';
    view.collectedAt = null;
    component.onProxyHistoryRefresh();
    fixture.detectChanges();
    expect(status()).toContain('Update failed');

    view.status = 'FRESH';
    view.healthMasked = true;
    view.collectedAt = new Date().toISOString();
    component.onProxyHistoryRefresh();
    fixture.detectChanges();
    expect(status()).toContain('Updated just now');
    expect(status()).toContain('Applying checker settings');
  });

  describe('re-requests', () => {
    beforeEach(() => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date('2026-11-15T12:00:00Z'));
    });
    afterEach(() => jasmine.clock().uninstall());

    it('asks again for a pending snapshot until a build publishes', () => {
      dashboardData.viewer.dashboardView.status = 'PENDING';
      component.onProxyHistoryRefresh();
      const afterRefresh = graphqlService.fetchDashboardData.calls.count();

      jasmine.clock().tick(4_001);
      expect(graphqlService.fetchDashboardData.calls.count()).toBe(afterRefresh + 1);

      dashboardData.viewer.dashboardView.status = 'FRESH';
      jasmine.clock().tick(4_001);
      expect(graphqlService.fetchDashboardData.calls.count()).toBe(afterRefresh + 2);
      jasmine.clock().tick(30_000);
      expect(graphqlService.fetchDashboardData.calls.count()).toBe(afterRefresh + 2);
    });

    it('stops after the re-request window', () => {
      dashboardData.viewer.dashboardView.rebuilding = true;
      component.onProxyHistoryRefresh();
      const afterRefresh = graphqlService.fetchDashboardData.calls.count();

      for (let elapsed = 0; elapsed < DASHBOARD_REREQUEST_WINDOW_MS + 5_000; elapsed += 1_000) {
        jasmine.clock().tick(1_000);
      }
      const settled = graphqlService.fetchDashboardData.calls.count();
      expect(settled).toBeGreaterThan(afterRefresh);
      expect(settled - afterRefresh).toBeLessThanOrEqual(DASHBOARD_REREQUEST_WINDOW_MS / 2_000);
      jasmine.clock().tick(60_000);
      expect(graphqlService.fetchDashboardData.calls.count()).toBe(settled);
    });
  });
});
