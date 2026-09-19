import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {HttpService} from './http.service';

describe('HttpService scrape source sorting', () => {
  let service: HttpService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    service = TestBed.inject(HttpService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  for (const [order, direction] of [[1, 'asc'], [-1, 'desc']] as const) {
    it(`sends ${direction} sorting alongside pagination, search, and filters`, () => {
      service.getScrapingSourcePage(2, {rows: 20, search: ' example ', filters: {protocols: ['https']}, sortField: 'health', sortOrder: order}).subscribe();
      const request = http.expectOne(req => req.url.endsWith('/getScrapingSourcesPage/2'));
      expect(request.request.params.get('sortField')).toBe('health');
      expect(request.request.params.get('sortOrder')).toBe(direction);
      expect(request.request.params.get('pageSize')).toBe('20');
      expect(request.request.params.get('search')).toBe('example');
      expect(request.request.params.getAll('protocol')).toEqual(['https']);
      request.flush([]);
    });
  }

  it('omits sort parameters for the default order', () => {
    service.getScrapingSourcePage(1).subscribe();
    const request = http.expectOne(req => req.url.endsWith('/getScrapingSourcesPage/1'));
    expect(request.request.params.has('sortField')).toBeFalse();
    expect(request.request.params.has('sortOrder')).toBeFalse();
    request.flush([]);
  });
});
