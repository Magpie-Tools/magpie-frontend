import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Subject, of, throwError} from 'rxjs';
import {ProxyCheckHistoryComponent} from './proxy-check-history.component';
import {HttpService} from '../../../services/http.service';
import {ProxyStatistic, ProxyStatisticsPage, ProxyStatisticsQuery} from '../../../models/ProxyStatistic';

function stat(id: number, overrides: Partial<ProxyStatistic> = {}): ProxyStatistic {
  return {
    id, alive: true, attempt: 0, retries: 2, response_time: 300 + id, protocol: 'socks5', transport: 'tcp',
    anonymity_level: 'elite', judge: 'http://httpbin.org/get', created_at: new Date().toISOString(), current: true, ...overrides,
  };
}

function page(statistics: ProxyStatistic[], total = statistics.length, counts = {alive: total, dead: 0}): ProxyStatisticsPage {
  return {
    statistics, total, page: 1, page_size: 20, counts,
    options: {protocols: [{protocol: 'socks5', transport: 'tcp'}], judges: [{id: 3, url: 'http://httpbin.org/get'}]},
  };
}

describe('ProxyCheckHistoryComponent', () => {
  let fixture: ComponentFixture<ProxyCheckHistoryComponent>;
  let component: ProxyCheckHistoryComponent;
  let getPage: jasmine.Spy<(id: number, query: ProxyStatisticsQuery) => ReturnType<HttpService['getProxyStatisticsPage']>>;
  let el: HTMLElement;

  beforeEach(() => localStorage.removeItem('magpie.proxyCheckHistory.pageSize'));
  afterEach(() => localStorage.removeItem('magpie.proxyCheckHistory.pageSize'));

  async function setup(firstResponse: ProxyStatisticsPage) {
    getPage = jasmine.createSpy('getProxyStatisticsPage').and.returnValue(of(firstResponse));
    await TestBed.configureTestingModule({
      imports: [ProxyCheckHistoryComponent],
      providers: [{provide: HttpService, useValue: {getProxyStatisticsPage: getPage} satisfies Partial<HttpService>}],
    }).compileComponents();
    fixture = TestBed.createComponent(ProxyCheckHistoryComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('proxyId', 7);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  const lastQuery = () => getPage.calls.mostRecent().args[1];
  const statusButton = (value: string) => el.querySelector<HTMLButtonElement>(`[data-status="${value}"]`)!;
  const header = (label: string) => Array.from(el.querySelectorAll<HTMLButtonElement>('.table-sort')).find(b => b.textContent?.includes(label))!;

  it('loads the newest checks first and renders them with the shared pagination', async () => {
    await setup(page([stat(1), stat(2, {alive: false, response_time: 2500})], 37, {alive: 30, dead: 7}));
    expect(getPage).toHaveBeenCalledWith(7, jasmine.objectContaining({page: 1, pageSize: 20, sort: 'checked', order: 'desc'}));
    expect(el.querySelectorAll('tr.row').length).toBe(2);
    expect(el.querySelector('app-pagination')).not.toBeNull();
    expect(statusButton('alive').textContent).toContain('30');
    expect(statusButton('dead').textContent).toContain('7');
    expect(statusButton('all').getAttribute('aria-pressed')).toBe('true');
    // A dead check has no latency: it reads "No response".
    expect(el.querySelectorAll('td.resp')[1].textContent).toContain('No response');
    expect(header('Checked at').closest('th')!.getAttribute('aria-sort')).toBe('descending');
  });

  it('emits the unfiltered first page for the latest-check fallback', async () => {
    const emitted: ProxyStatistic[][] = [];
    await setup(page([stat(1)]));
    component.firstPage.subscribe(rows => emitted.push(rows));
    getPage.and.returnValue(of(page([stat(5)])));
    component.setStatus('dead'); // filtered: not the latest-check source
    component.setStatus('all');
    expect(emitted.length).toBe(1);
    expect(emitted[0][0].id).toBe(5);
  });

  it('filters by status from page 1 and keeps the counts from the response', async () => {
    await setup(page([stat(1)], 37, {alive: 30, dead: 7}));
    getPage.and.returnValue(of(page([stat(9, {alive: false})], 7, {alive: 30, dead: 7})));
    statusButton('dead').click();
    fixture.detectChanges();
    expect(lastQuery()).toEqual(jasmine.objectContaining({page: 1, status: 'dead'}));
    expect(statusButton('dead').getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('[data-action="clear-head"]')).not.toBeNull();
  });

  it('cycles a column ascending, descending, then back to newest first', async () => {
    await setup(page([stat(1)]));
    header('Response').click();
    fixture.detectChanges();
    expect(lastQuery()).toEqual(jasmine.objectContaining({sort: 'response', order: 'asc'}));
    header('Response').click();
    fixture.detectChanges();
    expect(lastQuery()).toEqual(jasmine.objectContaining({sort: 'response', order: 'desc'}));
    header('Response').click();
    fixture.detectChanges();
    expect(lastQuery()).toEqual(jasmine.objectContaining({sort: 'checked', order: 'desc'}));
    // Anonymity starts with Elite first, shown as descending.
    header('Anonymity').click();
    fixture.detectChanges();
    expect(lastQuery()).toEqual(jasmine.objectContaining({sort: 'anonymity', order: 'desc'}));
  });

  it('ignores sort clicks while a request is pending', async () => {
    await setup(page([stat(1)]));
    const pending = new Subject<ProxyStatisticsPage>();
    getPage.and.returnValue(pending);
    component.setStatus('alive');
    fixture.detectChanges();
    const calls = getPage.calls.count();
    expect(header('Response').getAttribute('aria-disabled')).toBe('true');
    header('Response').click();
    expect(getPage.calls.count()).toBe(calls);
  });

  it('shows "No checks yet" when an unfiltered request has no results', async () => {
    await setup(page([], 0, {alive: 0, dead: 0}));
    expect(el.querySelector('.history-empty')?.textContent).toContain('No checks yet');
    expect(el.querySelector('.filter-bar')).toBeNull();
    expect(el.querySelector('app-pagination')).toBeNull();
  });

  it('shows the submitted filters when they match nothing, and clears them', async () => {
    await setup(page([stat(1)], 12, {alive: 10, dead: 2}));
    getPage.and.returnValue(of(page([], 0, {alive: 0, dead: 0})));
    component.setStatus('dead');
    component.setProtocol('socks5/tcp');
    fixture.detectChanges();
    expect(el.querySelector('.history-message')?.textContent).toContain('No checks match these filters');
    expect(el.querySelector('.filter-summary')?.textContent).toContain('Dead · SOCKS5 / TCP');
    expect(el.querySelector('app-pagination')).toBeNull();

    getPage.and.returnValue(of(page([stat(1)], 12, {alive: 10, dead: 2})));
    el.querySelector<HTMLButtonElement>('[data-action="clear-empty"]')!.click();
    fixture.detectChanges();
    expect(lastQuery().status).toBeUndefined();
    expect(lastQuery().protocol).toBeUndefined();
    expect(el.querySelector('[data-action="clear-head"]')).toBeNull();
  });

  it('keeps the error on screen while Try again runs, then shows the rows', async () => {
    await setup(page([stat(1)]));
    getPage.and.returnValue(throwError(() => new Error('down')));
    component.setStatus('alive');
    fixture.detectChanges();
    expect(el.querySelector('.history-message')?.textContent).toContain("Couldn't load check history");

    const pending = new Subject<ProxyStatisticsPage>();
    getPage.and.returnValue(pending);
    el.querySelector<HTMLButtonElement>('[data-action="retry"]')!.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-action="retry"]')?.getAttribute('aria-disabled')).toBe('true');
    expect(el.querySelectorAll('tr.row').length).toBe(0);

    pending.next(page([stat(1), stat(2)]));
    fixture.detectChanges();
    expect(el.querySelectorAll('tr.row').length).toBe(2);
    expect(el.querySelector('[data-action="retry"]')).toBeNull();
  });

  it('changes page through the shared pagination and remembers the page size', async () => {
    await setup(page([stat(1)], 120, {alive: 120, dead: 0}));
    component.onPageChange({first: 40, rows: 20});
    expect(lastQuery()).toEqual(jasmine.objectContaining({page: 3, pageSize: 20}));
    component.onPageChange({first: 0, rows: 50});
    expect(lastQuery()).toEqual(jasmine.objectContaining({page: 1, pageSize: 50}));
  });
});
