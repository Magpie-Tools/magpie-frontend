import {Component, inject, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {NotificationReadScopeDirective} from './notification-read-scope.directive';
import {NotificationReadService} from '../services/notification-read.service';
import {NotificationService} from '../services/notification-service.service';
import {environment} from '../../environments/environment';

@Component({selector: 'app-read-probe', template: ''})
class ReadProbe { readonly reads = inject(NotificationReadService); }

@Component({imports: [NotificationReadScopeDirective, ReadProbe], template: `
  @if (authenticated()) {
    <div appNotificationReadScope><app-read-probe /><app-read-probe /></div>
  }
`})
class SessionHost { readonly authenticated = signal(true); }

describe('NotificationReadScopeDirective', () => {
  it('shares read status within a session and discards it and pending requests on sign-out', () => {
    TestBed.configureTestingModule({imports: [SessionHost], providers: [
      provideHttpClient(), provideHttpClientTesting(),
      {provide: NotificationService, useValue: {showError: jasmine.createSpy('showError')}},
    ]});
    const fixture = TestBed.createComponent(SessionHost);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const probes = () => fixture.debugElement.queryAll(By.directive(ReadProbe)).map(node => node.componentInstance as ReadProbe);
    const first = probes()[0].reads;
    expect(probes()[1].reads).toBe(first);
    first.load(['release-1']);
    http.expectOne(request => request.url.endsWith('/notifications/read-state')).flush({read_ids: []});
    first.markRead('release-1');
    const write = http.expectOne(`${environment.apiUrl}/notifications/release-1/read`);
    expect(probes()[1].reads.isRead('release-1')).toBeTrue();
    fixture.componentInstance.authenticated.set(false);
    fixture.detectChanges();
    expect(write.cancelled).toBeTrue();
    fixture.componentInstance.authenticated.set(true);
    fixture.detectChanges();
    const next = probes()[0].reads;
    expect(next).not.toBe(first);
    next.load(['release-1']);
    http.expectOne(request => request.url.endsWith('/notifications/read-state')).flush({read_ids: []});
    expect(next.isUnread('release-1')).toBeTrue();
    fixture.destroy();
    http.verify();
  });
});
