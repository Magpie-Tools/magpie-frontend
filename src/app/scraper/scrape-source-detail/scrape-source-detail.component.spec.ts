import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MessageService} from 'primeng/api';
import {ActivatedRoute, convertToParamMap} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {of, throwError} from 'rxjs';
import {WorkspaceService} from '../../services/workspace.service';
import {SettingsService} from '../../services/settings.service';
import {ScrapeSourceDetailComponent} from './scrape-source-detail.component';
import {ScrapeSourceDetail} from '../../models/ScrapeSourceDetail';
import {ProxyInfo} from '../../models/ProxyInfo';
import {HttpService} from '../../services/http.service';

describe('ScrapeSourceDetailComponent', () => {
  let component: ScrapeSourceDetailComponent;
  let fixture: ComponentFixture<ScrapeSourceDetailComponent>;
  let httpServiceStub: {
    getScrapeSourceDetail: jasmine.Spy;
    getScrapeSourceProxyPage: jasmine.Spy;
    getProxyFilterOptions: jasmine.Spy;
    getProxyTags: jasmine.Spy;
    replaceProxyTags: jasmine.Spy;
    updateScrapeSourceSettings: jasmine.Spy;
  };

  beforeEach(async () => {
    const detail: ScrapeSourceDetail = {
      fetch_mode: 'http',
      id: 1,
      url: 'https://example.com',
      added_at: new Date().toISOString(),
      proxy_count: 24,
      alive_count: 14,
      dead_count: 6,
      unknown_count: 4,
      avg_reputation: 68,
      last_proxy_added_at: new Date().toISOString(),
      last_checked_at: new Date().toISOString(),
      reputation_breakdown: {
        good: 8,
        neutral: 7,
        poor: 5,
        unknown: 4,
      }
    };

    httpServiceStub = {
      updateScrapeSourceSettings: jasmine.createSpy('updateScrapeSourceSettings').and.returnValue(of({fetch_mode: 'browser'})),
      getScrapeSourceDetail: jasmine.createSpy('getScrapeSourceDetail').and.returnValue(of(detail)),
      getScrapeSourceProxyPage: jasmine.createSpy('getScrapeSourceProxyPage').and.returnValue(of({ proxies: [], total: 0 })),
      getProxyFilterOptions: jasmine.createSpy('getProxyFilterOptions').and.returnValue(of({countries: [], types: [], anonymityLevels: [], tags: []})),
      getProxyTags: jasmine.createSpy('getProxyTags').and.returnValue(of([])),
      replaceProxyTags: jasmine.createSpy('replaceProxyTags').and.returnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [ScrapeSourceDetailComponent, RouterTestingModule],
      providers: [
        MessageService,
        {provide: WorkspaceService, useValue: {canOperate: () => true}},
        {provide: SettingsService, useValue: {getUserSettings: () => undefined, userSettings$: of(undefined)}},
        {provide: HttpService, useValue: httpServiceStub},
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({id: '1'})),
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ScrapeSourceDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('saves JavaScript mode for this source and reloads its status', () => {
    httpServiceStub.getScrapeSourceDetail.calls.reset();
    component.setRequiresJavaScript(true);
    expect(httpServiceStub.updateScrapeSourceSettings).toHaveBeenCalledWith(1, 'browser');
    expect(httpServiceStub.getScrapeSourceDetail).toHaveBeenCalledWith(1);
    expect(component.savingFetchMode()).toBeFalse();
  });

  it('preserves the loaded mode after a failed settings update', async () => {
    httpServiceStub.updateScrapeSourceSettings.and.returnValue(throwError(() => new Error('unavailable')));
    const toggle: HTMLInputElement = fixture.nativeElement.querySelector('app-source-fetch-mode input');
    toggle.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(httpServiceStub.updateScrapeSourceSettings).toHaveBeenCalledWith(1, 'browser');
    expect(toggle.checked).toBeFalse();
    expect(component.detail()?.fetch_mode).toBe('http');
    expect(component.savingFetchMode()).toBeFalse();
  });

  it('does not allow viewers to change JavaScript mode', () => {
    spyOn(TestBed.inject(WorkspaceService), 'canOperate').and.returnValue(false);
    component.setRequiresJavaScript(true);
    expect(httpServiceStub.updateScrapeSourceSettings).not.toHaveBeenCalled();
  });

  it('shows scraping errors independently of proxy health', () => {
    component.detail.update(detail => detail ? {...detail, last_scrape_status: 'error', last_scrape_error: 'source returned HTTP 503'} : null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.source-scrape-status').textContent).toContain('Scrape failed');
    expect(fixture.nativeElement.querySelector('.scrape-error').textContent).toContain('HTTP 503');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the proxy status dot when the source payload has an empty lifecycle state', () => {
    const proxy: ProxyInfo = {
      id: 12,
      ip: '192.0.2.12',
      port: 8080,
      estimated_type: 'datacenter',
      response_time: 120,
      country: 'DE',
      anonymity_level: 'elite',
      alive: true,
      latest_check: new Date(),
      state: '' as ProxyInfo['state'],
    };

    component.proxies.set([proxy]);
    component.proxyHasLoaded.set(true);
    component.proxyTotal.set(1);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-proxy-table .status-dot.alive')).not.toBeNull();
  });

  it('reloads the first page with server sort parameters when sorting proxies', () => {
    httpServiceStub.getScrapeSourceProxyPage.calls.reset();
    component.proxyPage.set(3);
    component.proxyPageSize.set(20);

    component.onProxySort({field: 'reputation', order: -1});

    expect(component.proxyPage()).toBe(1);
    expect(component.proxySortField()).toBe('reputation');
    expect(component.proxySortOrder()).toBe(-1);
    expect(httpServiceStub.getScrapeSourceProxyPage).toHaveBeenCalledWith(1, jasmine.objectContaining({
      page: 1,
      rows: 20,
      sortField: 'reputation',
      sortOrder: -1,
    }));
  });

  it('clears proxy sort on the third click of the same column', () => {
    component.proxySortField.set('reputation');
    component.proxySortOrder.set(-1);
    httpServiceStub.getScrapeSourceProxyPage.calls.reset();

    component.onProxyLazyLoad({first: 0, rows: 20, sortField: 'reputation', sortOrder: 1});
    component.onProxySort({field: 'reputation', order: 1});

    expect(component.proxySortField()).toBeNull();
    expect(component.proxySortOrder()).toBeNull();
    expect(httpServiceStub.getScrapeSourceProxyPage).toHaveBeenCalledWith(1, jasmine.objectContaining({
      sortField: null,
      sortOrder: null,
    }));
  });

  it('requests only the optional proxy summaries needed by visible columns', () => {
    component.displayedColumns.set(['alive', 'ip_port', 'reputation']);
    httpServiceStub.getScrapeSourceProxyPage.calls.reset();

    component.onProxySort({field: 'alive', order: 1});

    expect(httpServiceStub.getScrapeSourceProxyPage).toHaveBeenCalledWith(1, jasmine.objectContaining({
      includeHealth: false,
      includeReputation: true,
    }));

    component.displayedColumns.set(['alive', 'ip_port', 'health_overall']);
    component.onProxySort({field: 'health_overall', order: 1});

    expect(httpServiceStub.getScrapeSourceProxyPage).toHaveBeenCalledWith(1, jasmine.objectContaining({
      includeHealth: true,
      includeReputation: false,
    }));
  });
});
