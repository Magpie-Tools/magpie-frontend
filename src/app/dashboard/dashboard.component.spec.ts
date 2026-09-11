import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { GraphqlService } from '../services/graphql.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let graphqlService: jasmine.SpyObj<GraphqlService>;

  beforeEach(async () => {
    graphqlService = jasmine.createSpyObj<GraphqlService>('GraphqlService', ['fetchDashboardData']);
    graphqlService.fetchDashboardData.and.returnValue(of({
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
    }));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        {provide: GraphqlService, useValue: graphqlService}
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
