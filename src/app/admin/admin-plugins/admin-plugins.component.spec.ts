import { ComponentFixture, TestBed } from '@angular/core/testing';

import {provideRouter} from '@angular/router';
import {BehaviorSubject, of} from 'rxjs';

import { AdminPluginsComponent } from './admin-plugins.component';
import {SettingsService} from '../../services/settings.service';
import {GlobalSettings, IPGeolocationStatus} from '../../models/GlobalSettings';
import {HttpService} from '../../services/http.service';

const timer = () => ({ days: 0, hours: 0, minutes: 0, seconds: 0 });

const defaultSettings: GlobalSettings = {
  protocols: { http: false, https: true, socks4: false, socks5: false },
  checker: {
    dynamic_threads: true,
    threads: 250,
    max_threads: 250,
    save_responses: true,
    retries: 2,
    timeout: 7500,
    monthly_checks_per_workspace: 1500000,
    unlimited_monthly_checks: false,
    judges_threads: 1,
    judges_timeout: 1000,
    judges: [],
    judge_timer: timer(),
    use_https_for_socks: true,
    ip_lookup: '',
    standard_header: [],
    proxy_header: []
  },
  scraper: {
    dynamic_threads: true,
    threads: 1,
    max_threads: 1,
    retries: 1,
    timeout: 1000,
    respect_robots_txt: true,
    monthly_scrapes_per_workspace: 3000,
    unlimited_monthly_scrapes: false,
    scrape_sites: []
  },
  proxy_limits: {
    enabled: false,
    max_per_user: 0,
    exclude_admins: true
  },
  plugins: {
    geolite: {
      enabled: true,
      api_key: '',
      auto_update: false,
      update_timer: timer(),
      last_updated_at: null
    },
    abuseipdb: {
      enabled: false,
      api_key: '',
      max_age_in_days: 30,
      daily_limit: 0,
      daily_remaining: 0,
      daily_reset_at: null,
      last_checked_at: null,
      last_error: ''
    }
  },
  blacklist_timer: timer(),
  blacklist_sources: [],
  website_blacklist: []
};

class SettingsServiceStub {
  settings$ = new BehaviorSubject<GlobalSettings | undefined>(defaultSettings);

  saveGlobalSettings = jasmine.createSpy('saveGlobalSettings').and.returnValue(of({ message: 'Saved' }));
}

class HttpServiceStub {
  getIPGeolocationStatus = jasmine.createSpy('getIPGeolocationStatus').and.returnValue(
    of<IPGeolocationStatus>({ used_credits: 120, daily_credit_limit: 300, reset_at: '2026-11-25T00:00:00Z', last_error: '' })
  );
}

const withPlugins = (plugins: Partial<GlobalSettings['plugins']>): GlobalSettings =>
  ({ ...defaultSettings, plugins: { ...defaultSettings.plugins, ...plugins } });

describe('AdminPluginsComponent', () => {
  let component: AdminPluginsComponent;
  let fixture: ComponentFixture<AdminPluginsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPluginsComponent],
      providers: [
        { provide: SettingsService, useClass: SettingsServiceStub },
        { provide: HttpService, useClass: HttpServiceStub },
        provideRouter([]),
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminPluginsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  const row = (id: string) => component.rows().find(r => r.id === id)!;

  it('flags GeoLite as enabled without a license key', () => {
    expect(row('geolite').status).toEqual(jasmine.objectContaining({ tone: 'bad', text: 'Enabled without a license key' }));
    expect(row('geolite').keyState).toBe('missing');
  });

  it('shows how old the GeoLite database is once configured', () => {
    const lastUpdated = new Date(Date.now() - 2 * 86_400_000 - 3_600_000).toISOString();
    component.settings.set(withPlugins({ geolite: { ...defaultSettings.plugins.geolite, api_key: 'license-key', last_updated_at: lastUpdated } }));

    expect(row('geolite').status).toEqual({ tone: 'good', text: 'Database updated 2 d ago' });
    expect(row('geolite').keyState).toBe('configured');
    expect(row('geolite').usageText).toBe('Local database');
  });

  it('shows the AbuseIPDB quota left today and flags an exhausted quota', () => {
    const abuseipdb = { ...defaultSettings.plugins.abuseipdb, enabled: true, api_key: 'key', daily_limit: 1000, daily_remaining: 412 };
    component.settings.set(withPlugins({ abuseipdb }));
    expect(row('abuseipdb').status.text).toBe('412 of 1,000 checks left today');
    expect(row('abuseipdb').usage).toEqual({ left: '412', limit: '1,000', usedPercent: 59, exhausted: false });

    component.settings.set(withPlugins({ abuseipdb: { ...abuseipdb, daily_remaining: 0 } }));
    expect(row('abuseipdb').status).toEqual({ tone: 'bad', text: 'Daily limit reached' });
    expect(row('abuseipdb').usage?.exhausted).toBeTrue();
  });

  it('reads IPGeolocation.io credits from its status endpoint', () => {
    component.settings.set(withPlugins({ ipgeolocation: {
      enabled: true, api_key: 'key', include_security: false, daily_credit_limit: 300, cache_hours: 168
    } }));

    expect(row('ipgeolocation').status.text).toBe('180 of 300 credits left today');
    expect(row('ipgeolocation').usage?.left).toBe('180');
  });

  it('marks disabled plugins without a key as not set up', () => {
    expect(row('abuseipdb').status).toEqual({ tone: 'off', text: 'Not set up' });
    expect(row('abuseipdb').keyState).toBe('unset');
    expect(row('abuseipdb').usage).toBeNull();
  });

  it('saves a switch change right away', () => {
    const service = TestBed.inject(SettingsService) as unknown as SettingsServiceStub;
    component.togglePlugin('abuseipdb', true);
    expect(service.saveGlobalSettings).toHaveBeenCalledWith({ plugins: { abuseipdb: { enabled: true } } });
    expect(component.isPluginEnabled('abuseipdb')).toBeTrue();
  });
});
