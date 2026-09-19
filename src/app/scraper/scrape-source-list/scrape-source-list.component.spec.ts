import {ComponentFixture, TestBed} from '@angular/core/testing';

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

  async function showSourceActions(admin = false, respectRobots = false): Promise<HTMLButtonElement[]> {
    component.isAdmin = admin;
    component.respectRobotsEnabled = respectRobots;
    component.displayedColumns = ['url', 'actions', 'actions_buttons'];
    component.scrapeSources.set([{
      id: 7, url: 'https://source.example/list', urlHead: 'https://source.example/', urlTail: 'list',
      proxy_count: 12, alive_count: 8, dead_count: 4, unknown_count: 0,
    }]);
    component.totalItems.set(1);
    component.hasLoaded.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.source-actions-trigger').click();
    fixture.detectChanges();
    await fixture.whenStable();
    return Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  }

  it('opens row actions without selecting the source and keeps inline Details available', async () => {
    const view = spyOn(component, 'onViewSource');
    const items = await showSourceActions();
    expect(component.selection.selected).toEqual([]);
    expect(items.map(item => item.textContent?.trim())).toEqual(['View details', 'Copy URL']);
    items[0].click();
    expect(view).toHaveBeenCalledWith({}, component.scrapeSources()[0]);
    const inline = fixture.nativeElement.querySelector('.column-actions_buttons button') as HTMLButtonElement;
    expect(inline.textContent).toContain('Details');
    inline.click();
    expect(view).toHaveBeenCalledTimes(2);
  });

  it('copies the source URL from the actions menu', async () => {
    const copy = spyOn(component.clipboardService, 'copyText').and.resolveTo(true);
    const items = await showSourceActions();
    items.find(item => item.textContent?.trim() === 'Copy URL')!.click();
    expect(copy).toHaveBeenCalledWith('https://source.example/list');
  });

  it('exposes enabled scrape and robots actions using the existing handlers', async () => {
    const scrape = spyOn(component, 'scrapeSourceNow');
    let items = await showSourceActions(true, true);
    items.find(item => item.textContent?.trim() === 'Scrape now')!.click();
    expect(scrape).toHaveBeenCalledWith(component.scrapeSources()[0]);
    const robots = spyOn(component, 'checkRobots');
    items = await showSourceActions(true, true);
    items.find(item => item.textContent?.trim() === 'Check robots.txt')!.click();
    expect(robots).toHaveBeenCalledWith(component.scrapeSources()[0]);
  });

  it('disables pending actions in the menu', async () => {
    component.scrapingSources[7] = true;
    component.checkingRobots[7] = true;
    const items = await showSourceActions(true, true);
    expect(items.find(item => item.textContent?.includes('Scrape queued'))!.disabled).toBeTrue();
    expect(items.find(item => item.textContent?.includes('Checking robots.txt'))!.disabled).toBeTrue();
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
  it('fetches sorting from page one, keeps rows while loading, and preserves the server order', async () => {
    const http = TestBed.inject(HttpService);
    const request = new Subject<any[]>();
    const getPage = http.getScrapingSourcePage as jasmine.Spy;
    getPage.calls.reset();
    getPage.and.returnValue(request);
    component.page = 3;
    component.searchTerm = 'example';
    const sources = [
      {id: 2, url: 'https://b.example', proxy_count: 2, alive_count: 1, dead_count: 1, unknown_count: 0},
      {id: 1, url: 'https://a.example', proxy_count: 2, alive_count: 1, dead_count: 1, unknown_count: 0},
    ];
    component.scrapeSources.set(sources.map(source => (component as any).buildViewSource(source)));
    component.sortColumn('alive_count');

    expect(component.page).toBe(0);
    expect(component.pageJumpValue).toBe(1);
    expect(getPage).toHaveBeenCalledOnceWith(1, jasmine.objectContaining({search: 'example', sortField: 'alive_count', sortOrder: 1}));
    expect(component.loading()).toBeTrue();
    expect(component.scrapeSources().map(source => source.id)).toEqual([2, 1]);
    request.next(sources);
    request.complete();
    await fixture.whenStable();
    expect(component.loading()).toBeFalse();
    expect(component.scrapeSources().map(source => source.id)).toEqual([2, 1]);

    getPage.and.returnValue(of([]));
    component.sortColumn('alive_count');
    expect(getPage).toHaveBeenCalledWith(1, jasmine.objectContaining({sortField: 'alive_count', sortOrder: -1}));
    await fixture.whenStable();
    component.onLazyLoad({first: component.pageSize, rows: component.pageSize, sortField: 'alive_count', sortOrder: -1});
    expect(getPage).toHaveBeenCalledWith(2, jasmine.objectContaining({sortField: 'alive_count', sortOrder: -1}));
    await fixture.whenStable();

    component.sortColumn('alive_count');
    expect(component.page).toBe(0);
    expect(component.sortField).toBeNull();
    expect(component.sortOrder).toBeNull();
    expect(getPage.calls.mostRecent().args).toEqual([1, jasmine.objectContaining({sortField: null, sortOrder: null})]);
    await fixture.whenStable();

    component.sortColumn('alive_count');
    expect(component.sortOrder).toBe(1);
    await fixture.whenStable();
    component.sortColumn('url');
    expect(component.sortField).toBe('url');
    expect(component.sortOrder).toBe(1);
    await fixture.whenStable();
  });

});
