import { ComponentFixture, TestBed } from '@angular/core/testing';
import {Component} from '@angular/core';
import {provideRouter} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import { of, Subject } from 'rxjs';
import {gsap} from 'gsap';

import { DashboardComponent } from './dashboard.component';
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
        dashboard: {
          totalChecks: 0,
          totalScraped: 0,
          totalChecksWeek: 0,
          totalScrapedWeek: 0,
          reputationBreakdown: {good: 0, neutral: 0, poor: 0, unknown: 0},
          countryBreakdown: [],
          judgeValidProxies: []
        },
        proxyCount: 0,
        proxyLimit: null,
        recentProxyChecks: [],
        fastestAliveProxies: [],
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
    dashboardData.viewer.proxyCount = 400;
    dashboardData.viewer.dashboard.totalScraped = 250;
    dashboardData.viewer.dashboard.totalScrapedWeek = 90;
    dashboardData.viewer.dashboard.judgeValidProxies = [
      {judgeUrl: 'https://judge-one.example', eliteProxies: 10, anonymousProxies: 20, transparentProxies: 0},
      {judgeUrl: 'https://judge-two.example', eliteProxies: 5, anonymousProxies: 10, transparentProxies: 5}
    ];

    component.onProxyHistoryRefresh();
    fixture.detectChanges();

    const cards: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('app-kpi-card');
    expect(Array.from(cards, card => card.querySelector('.metric-card__value')?.textContent?.trim())).toEqual(['50', '400', '250']);
    expect(fixture.nativeElement.querySelectorAll('.metric-card__trend').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('app-kpi-card app-dashboard-chart').length).toBe(0);
  });

  it('shows KPI trends only after real prior samples arrive', () => {
    const previousTime = '2026-10-16T10:00:00Z';
    const currentTime = '2026-10-16T11:00:00Z';
    dashboardData.viewer.proxyCount = 40;
    dashboardData.viewer.proxySnapshots = {
      alive: [{count: 12, recordedAt: currentTime}],
      scraped: [{count: 24, recordedAt: currentTime}]
    };

    component.onProxyHistoryRefresh();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.metric-card__trend').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('app-kpi-card app-dashboard-chart').length).toBe(0);

    dashboardData.viewer.proxySnapshots.alive.unshift({count: 10, recordedAt: previousTime});
    dashboardData.viewer.proxySnapshots.scraped.unshift({count: 20, recordedAt: previousTime});
    dashboardData.viewer.proxyHistory = [{count: 30, recordedAt: previousTime}];
    component.onProxyHistoryRefresh();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.metric-card__trend').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('app-kpi-card app-dashboard-chart').length).toBe(3);
  });

  for (const progress of [0.35, 1]) {
    it(`keeps the page entrance at ${progress} when dashboard data arrives`, async () => {
      fixture.destroy();
      const request = new Subject<DashboardQueryData>();
      graphqlService.fetchDashboardData.and.returnValue(request);
      fixture = TestBed.createComponent(DashboardComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      const header: HTMLElement = fixture.nativeElement.querySelector('.dashboard-context');
      const stage: HTMLElement = fixture.nativeElement.querySelector('.loading-stage');
      const entrance = gsap.getTweensOf(header)[0];
      expect(entrance).toBeDefined();
      expect(gsap.getTweensOf(stage)).toEqual([entrance]);
      entrance.pause().progress(progress);
      const initialOpacity = header.style.opacity;
      const initialTransform = header.style.transform;
      const skeleton: HTMLElement = fixture.nativeElement.querySelector('.dashboard-skeleton');
      expect(skeleton).not.toBeNull();

      request.next(dashboardData);
      request.complete();
      fixture.detectChanges();
      await fixture.whenStable();

      const content: HTMLElement = fixture.nativeElement.querySelector('.loading-stage__content');
      expect(fixture.nativeElement.querySelector('.loading-stage')).toBe(stage);
      expect(entrance.progress()).toBe(progress);
      expect(header.style.opacity).toBe(initialOpacity);
      expect(header.style.transform).toBe(initialTransform);
      expect(content.querySelector('app-kpi-card')).not.toBeNull();
      expect(content.style.transform).toBe('');
      expect(getComputedStyle(skeleton).position).toBe('absolute');
      expect(skeleton.classList).toContain('loading-stage__leave');
      expect(content.classList).toContain('loading-stage__enter');

      await Promise.all([...content.getAnimations(), ...skeleton.getAnimations()].map(animation => animation.finished));
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      expect(fixture.nativeElement.querySelector('.dashboard-skeleton')).toBeNull();
      expect(header.style.opacity).toBe(initialOpacity);
      expect(entrance.progress()).toBe(progress);
    });
  }

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

  it('clears the loading page and its entrance when navigating away', async () => {
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
    expect(gsap.getTweensOf(header)).toEqual([]);
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
});
