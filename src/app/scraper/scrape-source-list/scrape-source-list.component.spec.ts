import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MessageService} from 'primeng/api';
import {RouterTestingModule} from '@angular/router/testing';
import {BehaviorSubject, of, Subject, throwError} from 'rxjs';
import {ScrapeSourceListComponent} from './scrape-source-list.component';
import {HttpService} from '../../services/http.service';
import {SettingsService} from '../../services/settings.service';
import {UserService} from '../../services/authorization/user.service';
import {NotificationService} from '../../services/notification-service.service';

describe('ScrapeSourceListComponent', () => {
  const pageSizeStorageKey = 'magpie-scrape-source-list-page-size';
  let component: ScrapeSourceListComponent;
  let fixture: ComponentFixture<ScrapeSourceListComponent>;

  afterEach(() => {
    window.localStorage.removeItem(pageSizeStorageKey);
  });

  beforeEach(async () => {
    window.localStorage.removeItem(pageSizeStorageKey);

    const httpServiceStub = {
      getRespectRobotsSetting: jasmine.createSpy('getRespectRobotsSetting').and.returnValue(of({respect_robots_txt: false})),
      getScrapingSourcesCount: jasmine.createSpy('getScrapingSourcesCount').and.returnValue(of(0)),
      getScrapingSourcePage: jasmine.createSpy('getScrapingSourcePage').and.returnValue(of([])),
      exportScrapeSources: jasmine.createSpy('exportScrapeSources').and.returnValue(of('')),
      deleteScrapingSource: jasmine.createSpy('deleteScrapingSource').and.returnValue(of('')),
      requeueScrapeSource: jasmine.createSpy('requeueScrapeSource').and.returnValue(of({message: 'Scrape source queued successfully', source_id: 1})),
    } satisfies Partial<HttpService>;
    const settingsServiceStub = {
      getUserSettings: jasmine.createSpy('getUserSettings').and.returnValue(undefined),
      userSettings$: of(undefined),
      saveScrapeSourceListColumns: jasmine.createSpy('saveScrapeSourceListColumns').and.returnValue(of({message: 'ok'})),
    } satisfies Partial<SettingsService>;
    const userRoleSubject = new BehaviorSubject<string | undefined>('user');
    const userServiceStub = {
      role$: userRoleSubject.asObservable(),
    } satisfies Partial<UserService>;

    await TestBed.configureTestingModule({
      imports: [ScrapeSourceListComponent, RouterTestingModule],
      providers: [
        MessageService,
        {provide: HttpService, useValue: httpServiceStub},
        {provide: SettingsService, useValue: settingsServiceStub},
        {provide: UserService, useValue: userServiceStub},
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScrapeSourceListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('persists table row count changes', () => {
    component.pageSize = 40;

    component.onLazyLoad({first: 0, rows: 60});

    expect(window.localStorage.getItem(pageSizeStorageKey)).toBe('60');
  });

  it('clears the search and reloads the first page', () => {
    component.searchTerm = 'example.com';
    component.page = 2;
    spyOn(component, 'refreshList');

    component.clearSearch();

    expect(component.searchTerm).toBe('');
    expect(component.page).toBe(0);
    expect(component.refreshList).toHaveBeenCalled();
  });

  it('clears loading when the scrape-source request fails without a structured error body', async () => {
    const http = TestBed.inject(HttpService);
    const notification = TestBed.inject(NotificationService);
    spyOn(notification, 'showError');
    (http.getScrapingSourcePage as jasmine.Spy).and.returnValue(
      throwError(() => ({error: null, message: 'Connection closed'}))
    );

    component.getAndSetScrapeSourcesList();
    await fixture.whenStable();

    expect(component.loading()).toBeFalse();
    expect(component.hasLoaded()).toBeTrue();
    expect(notification.showError).toHaveBeenCalledWith('Could not get scraping sources: Connection closed');
  });

  it('clears loading when processing a successful response throws', async () => {
    const http = TestBed.inject(HttpService);
    const notification = TestBed.inject(NotificationService);
    spyOn(notification, 'showError');
    (http.getScrapingSourcePage as jasmine.Spy).and.returnValue(of([{
      id: 1,
      url: 'https://example.com',
      proxy_count: 1,
      alive_count: 1,
      dead_count: 0,
      unknown_count: 0,
    }]));
    spyOn<any>(component, 'buildViewSource').and.throwError('render failed');

    component.getAndSetScrapeSourcesList();
    await fixture.whenStable();

    expect(component.loading()).toBeFalse();
    expect(component.hasLoaded()).toBeTrue();
    expect(notification.showError).toHaveBeenCalledWith('Could not get scraping sources: render failed');
  });

  it('cancels an older scrape-source request before starting a new one', async () => {
    const http = TestBed.inject(HttpService);
    const firstRequest = new Subject<never[]>();
    const secondRequest = new Subject<never[]>();
    (http.getScrapingSourcePage as jasmine.Spy).and.returnValues(firstRequest, secondRequest);

    component.getAndSetScrapeSourcesList();
    expect(firstRequest.observed).toBeTrue();

    component.getAndSetScrapeSourcesList();

    expect(firstRequest.observed).toBeFalse();
    expect(secondRequest.observed).toBeTrue();
    expect(component.loading()).toBeTrue();

    secondRequest.next([]);
    secondRequest.complete();
    await fixture.whenStable();
    expect(component.loading()).toBeFalse();
  });

  it('defers a synchronous request completion until after the current render pass', async () => {
    const http = TestBed.inject(HttpService);
    (http.getScrapingSourcePage as jasmine.Spy).and.returnValue(of([]));

    component.getAndSetScrapeSourcesList();

    expect(component.loading()).toBeTrue();
    await fixture.whenStable();
    expect(component.loading()).toBeFalse();
  });
});
