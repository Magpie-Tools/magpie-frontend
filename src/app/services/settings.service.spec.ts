import {of, Subject} from 'rxjs';
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

      expect(http.saveUserSettings.calls.mostRecent().args[0].failure_action).toBeUndefined();
      expect(service.getUserSettings()?.failure_action).toBe('delete');
    });
  }
  it('keeps the last saved settings when saving fails', () => {
    const saved = service.getUserSettings();
    const response = new Subject<any>();
    http.saveUserSettings.and.returnValue(response);
    service.saveUserSettings({Retries: 0}).subscribe({error: () => {}});
    expect(service.getUserSettings()).toBe(saved);
    response.error(new Error('offline'));
    expect(service.getUserSettings()).toBe(saved);
  });

  it('omits cached checker profiles when saving unrelated preferences', () => {
    const current = service.getUserSettings()!;
    current.checker_settings = {
      defaults: {protocols: ['http', 'https', 'socks4', 'socks5'], transport: 'tcp', timeout: 2000, retries: 0},
      rules: [{tag_id: 9, mode: 'remove', protocols: ['http']}],
    };
    service.saveProxyListColumns(['ip_port']).subscribe();
    expect(http.saveUserSettings.calls.mostRecent().args[0]).toEqual({proxy_list_columns: ['ip_port', 'tags']});
    expect(service.getUserSettings()?.checker_settings).toEqual(current.checker_settings);
  });

  it('sends only judges when saving judges with a stale deleted-tag profile', () => {
    service.getUserSettings()!.checker_settings = {
      defaults: {protocols: ['http'], transport: 'tcp', timeout: 1000, retries: 0},
      rules: [{tag_id: 9, mode: 'remove', protocols: ['http']}],
    };
    service.saveUserSettings({judges: []}).subscribe();
    expect(http.saveUserSettings.calls.mostRecent().args[0]).toEqual({judges: []});
  });

  it('sends checker profiles when explicitly saving them', () => {
    const profiles: UserSettings['checker_settings'] = {defaults: {protocols: ['http'], transport: 'tcp', timeout: 1000, retries: 0}, rules: []};
    service.saveUserSettings({checker_settings: profiles}).subscribe();
    expect(http.saveUserSettings.calls.mostRecent().args[0]).toEqual({checker_settings: profiles});
  });
});
