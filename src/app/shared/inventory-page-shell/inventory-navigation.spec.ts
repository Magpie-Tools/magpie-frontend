import {provideHttpClient, withFetch} from '@angular/common/http';
import {ApplicationRef, provideZonelessChangeDetection, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NavigationEnd, provideRouter, Router} from '@angular/router';
import {filter, firstValueFrom, of, take} from 'rxjs';
import {gsap} from 'gsap';
import {AppComponent} from '../../app.component';
import {DashboardComponent} from '../../dashboard/dashboard.component';
import {ProxiesComponent} from '../../proxies/proxies.component';
import {ScraperComponent} from '../../scraper/scraper.component';
import {UserService} from '../../services/authorization/user.service';
import {GraphqlService} from '../../services/graphql.service';
import {SettingsService} from '../../services/settings.service';
import {WorkspaceService} from '../../services/workspace.service';
import {WorkspaceInvitationService} from '../../services/workspace-invitation.service';

describe('Inventory sidebar navigation', () => {
  let fixture: ComponentFixture<AppComponent>;
  let pendingList: {path: string; responded: boolean; respond: (body: unknown) => void} | undefined;

  function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {headers: {'Content-Type': 'application/json'}});
  }

  beforeEach(async () => {
    UserService.setLoggedIn(true);
    UserService.setRole('user');
    pendingList = undefined;
    // Exercise the production Fetch backend, including its pending-task tracking.
    spyOn(window, 'fetch').and.callFake((input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(input instanceof Request ? input.url : String(input), window.location.href).pathname;
      if (/\/get(?:Proxy|ScrapingSources)Page\//.test(path)) {
        return new Promise<Response>((resolve, reject) => {
          pendingList = {path, responded: false, respond: body => {
            pendingList!.responded = true;
            resolve(jsonResponse(body));
          }};
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {once: true});
        });
      }
      if (path.endsWith('/alerts')) {
        return Promise.resolve(jsonResponse({rules: [], destinations: [], incidents: [], deliveries: [], next_cursor: 0}));
      }
      if (path.endsWith('/releases')) {
        return Promise.resolve(jsonResponse({releases: [], build: {buildVersion: 'dev', builtAt: 'unknown'}}));
      }
      return Promise.resolve(jsonResponse(path.endsWith('/getScrapingSourcesCount') ? 0
        : path.endsWith('/respectRobots') ? {respect_robots_txt: false} : []));
    });
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withFetch()),
        provideRouter([
          {path: 'dashboard', component: DashboardComponent},
          {path: 'proxies', component: ProxiesComponent},
          {path: 'scraper', component: ScraperComponent},
        ]),
        {provide: UserService, useValue: {email: signal('test@example.invalid'), role$: of('user')}},
        {provide: SettingsService, useValue: {getUserSettings: () => undefined, userSettings$: of(undefined)}},
        {provide: GraphqlService, useValue: {fetchDashboardData: () => of({viewer: {
          dashboard: {totalChecks: 0, totalScraped: 0, totalChecksWeek: 0, totalScrapedWeek: 0,
            reputationBreakdown: {good: 0, neutral: 0, poor: 0, unknown: 0}, countryBreakdown: [], judgeValidProxies: []},
          proxyCount: 0, proxyLimit: null, recentProxyChecks: [], fastestAliveProxies: [],
          proxyHistory: [], proxySnapshots: {alive: [], scraped: []}, scrapeSourceCount: 0,
        }})}},
        {provide: WorkspaceService, useValue: {
          current: signal({id: 1, name: 'Test workspace', role: 'owner'}),
          workspaces: signal([{id: 1, name: 'Test workspace', role: 'owner'}]),
          loading: signal(false), canOperate: () => true, load: () => of([]),
        }},
        {provide: WorkspaceInvitationService, useValue: {
          invitations: signal([]), pendingCount: () => 0, loading: signal(false), error: signal(null), load: () => of([]),
        }},
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/dashboard');
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    gsap.ticker.wake();
    UserService.setLoggedIn(false);
    UserService.setRole('user');
  });

  for (const route of ['proxies', 'scraper']) {
    it(`animates ${route} immediately after a sidebar click while its table request remains pending`, async () => {
      const navigation = firstValueFrom(TestBed.inject(Router).events.pipe(
        filter(event => event instanceof NavigationEnd), take(1),
      ));
      fixture.nativeElement.querySelector(`app-navbar a[href="/${route}"]`).click();
      await navigation;
      fixture.detectChanges();
      // Keep the table's Fetch request open and allow just the first browser frame.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      const heading = element.querySelector<HTMLElement>('.inventory-context')!;
      const toolbar = element.querySelector<HTMLElement>('.inventory-toolbar')!;
      const grid = element.querySelector<HTMLElement>('.inventory-grid')!;
      const entrance = grid.getAnimations()[0];
      const headingEntrance = heading.getAnimations()[0];
      expect(entrance).toBeInstanceOf(CSSAnimation);
      expect(headingEntrance).toBeInstanceOf(CSSAnimation);
      expect(getComputedStyle(heading).transform).not.toBe('none');
      expect(getComputedStyle(grid).transform).not.toBe('none');
      expect(heading.querySelector('h1')!.textContent).toContain(route === 'proxies' ? 'Managed proxies' : 'Scrape sources');
      for (const target of [heading, toolbar, grid]) {
        expect(getComputedStyle(target).opacity).toBe('1');
        expect(getComputedStyle(target).visibility).toBe('visible');
      }
      expect(element.querySelector<HTMLInputElement>('.inventory-search-input')!.disabled).toBeFalse();
      expect(toolbar.textContent).toContain('Filters');
      expect(toolbar.textContent).toContain('Columns');
      expect(element.querySelector('.data-table')!.getAttribute('aria-busy')).toBe('true');
      expect(element.querySelector(route === 'proxies' ? 'app-add-proxies' : 'app-add-scrape-source')).not.toBeNull();

      expect(pendingList!.path).toContain(route === 'proxies' ? '/getProxyPage/' : '/getScrapingSourcesPage/');
      let applicationStable = true;
      const stability = TestBed.inject(ApplicationRef).isStable.subscribe(stable => applicationStable = stable);
      // Even a stopped JS animation ticker must not freeze this page's entrance.
      gsap.ticker.sleep();
      const initialY = new DOMMatrixReadOnly(getComputedStyle(grid).transform).m42;
      await new Promise<void>(resolve => setTimeout(resolve, 200));
      const intermediateY = new DOMMatrixReadOnly(getComputedStyle(grid).transform).m42;
      expect(intermediateY).toBeGreaterThan(0);
      expect(intermediateY).toBeLessThan(initialY);
      expect(entrance.playState).toBe('running');
      expect(pendingList!.responded).toBeFalse();
      expect(applicationStable).toBeFalse();

      // Observe natural completion without advancing animation time or responding to HTTP.
      await Promise.all([entrance.finished, headingEntrance.finished]);
      stability.unsubscribe();
      expect(getComputedStyle(heading).transform).toBe('none');
      expect(getComputedStyle(grid).transform).toBe('none');
      expect(getComputedStyle(heading).opacity).toBe('1');
      expect(getComputedStyle(grid).opacity).toBe('1');
      expect(element.querySelector('.data-table')!.getAttribute('aria-busy')).toBe('true');
      expect(pendingList!.responded).toBeFalse();
      pendingList!.respond(route === 'proxies' ? {proxies: [], total: 0} : []);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(element.querySelector('.inventory-toolbar')).toBe(toolbar);
      expect(grid.getAnimations()).toEqual([]);
    });
  }
});
