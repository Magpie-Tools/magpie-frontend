import {of, throwError} from 'rxjs';
import {HttpService} from '../services/http.service';
import {NotificationService} from '../services/notification-service.service';
import {loadProxyFilterOptions} from './proxy-filter-options';

describe('loadProxyFilterOptions', () => {
  it('allows a fresh request after failure and normalizes successful options', () => {
    const http = jasmine.createSpyObj<HttpService>('HttpService', ['getProxyFilterOptions']);
    const notification = jasmine.createSpyObj<NotificationService>('NotificationService', ['showError']);
    http.getProxyFilterOptions.and.returnValues(
      throwError(() => ({error: {message: 'Unavailable'}})),
      of({countries: ['N/A', 'US', 'DE'], types: ['residential'], anonymityLevels: [], tags: []}),
    );
    const next = jasmine.createSpy('next');
    loadProxyFilterOptions(http, notification).subscribe(next);
    expect(next).not.toHaveBeenCalled();
    expect(notification.showError).toHaveBeenCalledWith('Could not load filter options: Unavailable');
    loadProxyFilterOptions(http, notification).subscribe(next);
    expect(http.getProxyFilterOptions).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledWith(jasmine.objectContaining({
      countries: [
        {label: 'DE', value: 'DE'}, {label: 'US', value: 'US'}, {label: 'N/A', value: 'N/A'},
      ],
    }));
  });
});
