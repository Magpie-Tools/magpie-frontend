import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {environment} from '../../environments/environment';
import {NotificationReadService} from './notification-read.service';
import {NotificationService} from './notification-service.service';

describe('NotificationReadService', () => {
  let service: NotificationReadService;
  let http: HttpTestingController;
  let notifications: jasmine.SpyObj<NotificationService>;
  const url = `${environment.apiUrl}/notifications`;

  beforeEach(() => {
    notifications = jasmine.createSpyObj('NotificationService', ['showError']);
    TestBed.configureTestingModule({providers: [
      provideHttpClient(), provideHttpClientTesting(), NotificationReadService,
      {provide: NotificationService, useValue: notifications},
    ]});
    service = TestBed.inject(NotificationReadService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function load(ids = ['invitation-1', 'alert-1', 'release-1']) {
    service.load(ids);
    return http.expectOne(request => request.url === `${url}/read-state`
      && request.params.get('ids') === ids.join(','));
  }

  it('uses server receipts and leaves unknown status uncounted while loading', () => {
    const request = load();
    expect(service.loading()).toBeTrue();
    expect(service.isUnread('alert-1')).toBeFalse();
    request.flush({read_ids: ['invitation-1']});
    expect(service.isUnread('invitation-1')).toBeFalse();
    expect(service.isUnread('alert-1')).toBeTrue();
    expect(service.isUnread('release-1')).toBeTrue();
    expect(service.loading()).toBeFalse();
  });

  it('updates immediately on click, saves once, and keeps the event read on refresh', () => {
    load().flush({read_ids: []});
    service.markRead('alert-1');
    service.markRead('alert-1');
    expect(service.isUnread('alert-1')).toBeFalse();
    const write = http.expectOne(`${url}/alert-1/read`);
    expect(write.request.method).toBe('PUT');
    write.flush(null);
    // Simulate a GET snapshot that was produced before the write committed.
    load().flush({read_ids: []});
    expect(service.isUnread('alert-1')).toBeFalse();
    service.markRead('alert-1');
    http.expectNone(`${url}/alert-1/read`);
  });

  it('restores unread state after a failed save and allows another click to retry', () => {
    load().flush({read_ids: []});
    service.markRead('release-1');
    http.expectOne(`${url}/release-1/read`).flush({error: 'Unavailable'}, {status: 503, statusText: 'Unavailable'});
    expect(service.isUnread('release-1')).toBeTrue();
    expect(notifications.showError).toHaveBeenCalled();
    service.markRead('release-1');
    http.expectOne(`${url}/release-1/read`).flush(null);
    expect(service.isUnread('release-1')).toBeFalse();
  });

  it('does not undo a successful click when an older state request finishes', () => {
    load().flush({read_ids: []});
    const oldSnapshot = load();
    service.markRead('invitation-1');
    http.expectOne(`${url}/invitation-1/read`).flush(null);
    oldSnapshot.flush({read_ids: []});
    expect(service.isUnread('invitation-1')).toBeFalse();
  });

  it('picks up a read from another browser on the next load', () => {
    load().flush({read_ids: []});
    expect(service.isUnread('alert-1')).toBeTrue();
    load().flush({read_ids: ['alert-1']});
    expect(service.isUnread('alert-1')).toBeFalse();
  });

  it('supports the bell and release page loading different IDs at the same time', () => {
    const alerts = load(['alert-1']);
    load(['invitation-1']).flush({read_ids: []});
    expect(alerts.cancelled).toBeFalse();
    expect(service.loading()).toBeTrue();
    expect(service.isUnread('invitation-1')).toBeTrue();
    alerts.flush({read_ids: []});
    expect(service.isUnread('alert-1')).toBeTrue();
    service.load([]);
    http.expectNone(request => request.url === `${url}/read-state`);
    expect(service.loading()).toBeFalse();
  });

  it('reports load failures without discarding known read state, then clears the error on retry', () => {
    load().flush({read_ids: ['release-1']});
    load().flush({}, {status: 503, statusText: 'Unavailable'});
    expect(service.error()).toBeTrue();
    expect(service.isUnread('release-1')).toBeFalse();
    expect(service.isUnread('alert-1')).toBeTrue();
    load().flush({read_ids: ['release-1']});
    expect(service.error()).toBeFalse();
  });

  it('cancels in-flight requests when the authenticated shell is destroyed', () => {
    const read = load();
    service.markRead('alert-1');
    const write = http.expectOne(`${url}/alert-1/read`);
    TestBed.resetTestingModule();
    expect(read.cancelled).toBeTrue();
    expect(write.cancelled).toBeTrue();
  });

  it('deduplicates concurrent loads and splits a large release archive into bounded requests', () => {
    const ids = Array.from({length: 60}, (_, index) => `release-${index + 1}`);
    service.load(ids);
    service.load(ids);
    const requests = http.match(request => request.url === `${url}/read-state`);
    expect(requests.length).toBe(2);
    expect(requests.map(request => request.request.params.get('ids')!.split(',').length)).toEqual([50, 10]);
    for (const request of requests) request.flush({read_ids: []});
    expect(service.hasStatus('release-60')).toBeTrue();
    expect(service.isUnread('release-60')).toBeTrue();
    expect(service.loading()).toBeFalse();
  });
});
