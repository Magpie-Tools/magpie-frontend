import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {HttpService} from './http.service';

describe('HttpService proxy page parameters', () => {
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

  for (const sourceId of [null, 7]) {
    const scope = sourceId === null ? 'workspace' : 'scrape-source';
    const url = sourceId === null ? '/getProxyPage/3' : '/scrapingSources/7/proxies';
    const loadPage = (options?: Parameters<HttpService['getScrapeSourceProxyPage']>[1]) => sourceId === null
      ? service.getProxyPage(3, options)
      : service.getScrapeSourceProxyPage(sourceId, options);

    for (const [order, direction] of [[1, 'asc'], [-1, 'desc']] as const) {
      it(`preserves ${scope} pagination, flags, filters, and ${direction} sorting`, () => {
        loadPage({
          page: 3, rows: 50, search: ' provider ', includeHealth: false, includeReputation: true,
          sortField: 'response_time', sortOrder: order,
          filters: {
            states: ['paused', 'archived'], status: 'alive', protocols: ['http', 'socks5'],
            minHealthOverall: 90, minHealthHttp: 80, minHealthHttps: 70, minHealthSocks4: 60, minHealthSocks5: 50,
            countries: ['DE', 'US'], types: ['residential'], anonymityLevels: ['elite'],
            reputationLabels: ['good', 'neutral'], tagIds: [2, 7], maxTimeout: 1000, maxRetries: 3,
          },
        }).subscribe();

        const request = http.expectOne(req => req.url.endsWith(url));
        const expected: Record<string, string[]> = {
          pageSize: ['50'], search: ['provider'], includeHealth: ['false'], includeReputation: ['true'],
          sortField: ['response_time'], sortOrder: [direction], state: ['paused', 'archived'], status: ['alive'],
          protocol: ['http', 'socks5'], minHealthOverall: ['90'], minHealthHttp: ['80'], minHealthHttps: ['70'],
          minHealthSocks4: ['60'], minHealthSocks5: ['50'], country: ['DE', 'US'], type: ['residential'],
          anonymity: ['elite'], reputation: ['good', 'neutral'], tagId: ['2', '7'], maxTimeout: ['1000'], maxRetries: ['3'],
        };
        if (sourceId !== null) {
          expected['page'] = ['3'];
        }

        expect(request.request.method).toBe('GET');
        expect(request.request.params.keys().sort()).toEqual(Object.keys(expected).sort());
        for (const [key, values] of Object.entries(expected)) {
          expect(request.request.params.getAll(key)).withContext(key).toEqual(values);
        }
        request.flush({proxies: [], total: 0});

        loadPage().subscribe();
        const nextRequest = http.expectOne(req => req.url.endsWith(url));
        expect(nextRequest.request.params.keys()).toEqual(sourceId === null ? [] : ['page']);
        if (sourceId !== null) {
          expect(nextRequest.request.params.get('page')).toBe('1');
        }
        nextRequest.flush({proxies: [], total: 0});
      });
    }

    it(`omits empty ${scope} options and inactive sorting`, () => {
      loadPage({page: 0, rows: 0, search: ' ', sortField: 'response_time', sortOrder: 0}).subscribe();
      const request = http.expectOne(req => req.url.endsWith(url));
      expect(request.request.params.keys()).toEqual(sourceId === null ? [] : ['page']);
      if (sourceId !== null) {
        expect(request.request.params.get('page')).toBe('1');
      }
      request.flush({proxies: [], total: 0});
    });
  }
});
