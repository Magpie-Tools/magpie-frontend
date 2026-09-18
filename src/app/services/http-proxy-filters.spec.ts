import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {HttpService} from './http.service';

describe('HttpService proxy lifecycle filters', () => {
  let service: HttpService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    service = TestBed.inject(HttpService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends lifecycle state separately from alive status and search', () => {
    service.getProxyPage(2, {search: 'provider', filters: {states: ['paused', 'archived'], status: 'alive'}}).subscribe();
    const request = http.expectOne(req => req.url.endsWith('/getProxyPage/2'));
    expect(request.request.params.getAll('state')).toEqual(['paused', 'archived']);
    expect(request.request.params.get('status')).toBe('alive');
    expect(request.request.params.get('search')).toBe('provider');
    request.flush({proxies: [], total: 0});
  });

  it('sends the same lifecycle filter for scrape-source proxies', () => {
    service.getScrapeSourceProxyPage(7, {filters: {states: ['archived']}}).subscribe();
    const request = http.expectOne(req => req.params.get('state') === 'archived');
    request.flush({proxies: [], total: 0});
  });
});
