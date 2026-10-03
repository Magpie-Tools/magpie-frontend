import {of} from 'rxjs';
import {SettingsService} from './settings.service';
import {HttpService} from './http.service';
import {UserService} from './authorization/user.service';
import {NotificationService} from './notification-service.service';
import {UserSettings} from '../models/UserSettings';

describe('SettingsService failure action', () => {
  let service: SettingsService;
  let http: jasmine.SpyObj<HttpService>;

  beforeEach(() => {
    const settings: UserSettings = {
      http_protocol: false,
      https_protocol: true,
      socks4_protocol: false,
      socks5_protocol: false,
      timeout: 7500,
      retries: 2,
      UseHttpsForSocks: true,
      transport_protocol: 'tcp',
      auto_remove_failing_proxies: true,
      auto_remove_failure_threshold: 3,
      failure_action: 'delete',
      judges: [],
      scraping_sources: [],
    };
    spyOn(UserService, 'isLoggedIn').and.returnValue(true);
    spyOn(UserService, 'isAdmin').and.returnValue(false);
    http = jasmine.createSpyObj<HttpService>('HttpService', ['getUserSettings', 'saveUserSettings']);
    http.getUserSettings.and.returnValue(of(settings));
    http.saveUserSettings.and.returnValue(of({message: 'saved'}));
    service = new SettingsService(http, {role$: of('user')} as UserService, {} as NotificationService);
  });

  it('maps the checker form action to the API field', () => {
    service.saveUserSettings({FailureAction: 'pause'}).subscribe();

    expect(http.saveUserSettings).toHaveBeenCalledWith(jasmine.objectContaining({failure_action: 'pause'}));
  });

  for (const preference of ['proxy list', 'source proxies', 'source list']) {
    it(`preserves Delete when saving ${preference} columns`, () => {
      if (preference === 'proxy list') {
        service.saveProxyListColumns(['ip_port', 'country']).subscribe();
      } else if (preference === 'source proxies') {
        service.saveScrapeSourceProxyColumns(['ip_port', 'country']).subscribe();
      } else {
        service.saveScrapeSourceListColumns(['url', 'proxy_count']).subscribe();
      }

      expect(http.saveUserSettings).toHaveBeenCalledWith(jasmine.objectContaining({failure_action: 'delete'}));
      expect(service.getUserSettings()?.failure_action).toBe('delete');
    });
  }
});
