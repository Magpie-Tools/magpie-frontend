import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProxyDetailComponent} from './proxy-detail.component';
import {ActivatedRoute, convertToParamMap} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {of} from 'rxjs';
import {By} from '@angular/platform-browser';
import {HttpService} from '../../services/http.service';
import {ProxyDetail} from '../../models/ProxyDetail';
import {ProxyStatistic} from '../../models/ProxyStatistic';
import {ProxyStatisticHours} from '../../models/ProxyStatisticHour';
import {CountryHoverCardComponent} from '../../shared/ui/country-hover-card.component';

describe('ProxyDetailComponent', () => {
  let component: ProxyDetailComponent;
  let fixture: ComponentFixture<ProxyDetailComponent>;
  let hourlyStatistics: jasmine.Spy;

  beforeEach(async () => {
    const detail: ProxyDetail = {
      id: 1,
      ip: '127.0.0.1',
      port: 8080,
      username: '',
      password: '',
      has_auth: false,
      estimated_type: 'datacenter',
      country: 'Unknown',
      created_at: new Date().toISOString(),
      latest_check: new Date().toISOString(),
      latest_statistic: null,
    };

    hourlyStatistics = jasmine.createSpy('getProxyStatisticHours').and.returnValue(of({since: new Date().toISOString(), hours: []} as ProxyStatisticHours));
    const httpServiceStub = {
      getProxyStatisticHours: hourlyStatistics,
      getProxyDetail: jasmine.createSpy('getProxyDetail').and.returnValue(of(detail)),
      getProxyStatistics: jasmine.createSpy('getProxyStatistics').and.returnValue(of([] as ProxyStatistic[])),
      getProxyTags: jasmine.createSpy('getProxyTags').and.returnValue(of([])),
      replaceProxyTags: jasmine.createSpy('replaceProxyTags').and.returnValue(of([])),
    } satisfies Partial<HttpService>;

    await TestBed.configureTestingModule({
      imports: [ProxyDetailComponent, RouterTestingModule],
      providers: [
        {provide: HttpService, useValue: httpServiceStub},
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({id: '1'})),
            snapshot: {
              queryParamMap: convertToParamMap({}),
            },
          }
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProxyDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('passes the current proxy country to the map hover card', () => {
    component.detail.update(detail => detail ? {...detail, country: 'Germany'} : detail);
    fixture.detectChanges();
    const country = fixture.debugElement.query(By.directive(CountryHoverCardComponent)).componentInstance as CountryHoverCardComponent;
    expect(country.country()).toBe('Germany');
    component.detail.update(detail => detail ? {...detail, country: 'Singapore'} : detail);
    fixture.detectChanges();
    expect(country.country()).toBe('Singapore');
  });

  it('shows an empty latest-check summary before any results exist', () => {
    const summary = fixture.debugElement.query(By.css('.check-summary')).nativeElement as HTMLElement;
    expect(summary.textContent).toContain('Not checked');
    expect(summary.textContent).toContain('No check results yet');
  });

  it('shows the empty trend and renders a responsive SVG when hourly results arrive', async () => {
    expect(fixture.nativeElement.querySelector('.mini-chart').textContent).toContain('No response-time trend yet.');
    const since = new Date(Date.now() - 2 * 3_600_000);
    since.setMinutes(0, 0, 0);
    component.statisticHours.set({since: since.toISOString(), hours: [
      {hour: since.toISOString(), checks: 4, failed: 1, avg_response_time: 120},
      {hour: new Date(since.getTime() + 3_600_000).toISOString(), checks: 4, failed: 0, avg_response_time: 180},
    ]});
    fixture.detectChanges();
    for (let frame = 0; frame < 4; frame++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    await fixture.whenStable();
    const chart = fixture.nativeElement.querySelector('.mini-chart app-chart');
    expect(chart).not.toBeNull();
    expect(chart.querySelector('canvas')).toBeNull();
    const svg: SVGSVGElement = chart.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.viewBox.baseVal.width).toBeGreaterThan(0);
    expect(svg.viewBox.baseVal.height).toBeGreaterThan(0);
    expect(svg.textContent).toContain('ms');
  });

  it('shows the latest check result even when another protocol is alive', () => {
    const latest: ProxyStatistic = {
      id: 12,
      attempt: 1,
      protocol: 'https',
      judge: 'https://judge.example.com',
      anonymity_level: 'unknown',
      response_time: 7500,
      alive: false,
      created_at: '2026-09-19T14:00:00Z',
    };
    component.detail.update(detail => detail ? {...detail, latest_statistic: latest} : detail);
    component.statistics.set([
      latest,
      {...latest, id: 11, protocol: 'socks5', alive: true, created_at: '2026-09-19T13:00:00Z'},
    ]);
    fixture.detectChanges();

    const summary = fixture.debugElement.query(By.css('.check-summary')).nativeElement as HTMLElement;
    expect(summary.textContent).toContain('Dead');
    expect(summary.querySelector('.status-dot.dead')).not.toBeNull();
    const protocol = fixture.debugElement.queryAll(By.css('.detail-item'))
      .find(item => item.nativeElement.textContent.includes('Check protocol'));
    expect(protocol?.nativeElement.textContent).toContain('HTTPS');
  });

  it('should truncate the latest judge and expose the full value in the title', () => {
    const longJudge = 'https://judge.example.com/some/really/long/path/that/should/not/wrap/in/the/card';
    const statistic: ProxyStatistic = {
      id: 10,
      attempt: 1,
      protocol: 'http',
      judge: longJudge,
      anonymity_level: 'elite',
      response_time: 250,
      alive: true,
      created_at: new Date().toISOString(),
    };

    component.detail.update(detail => detail ? {...detail, latest_statistic: statistic} : detail);
    fixture.detectChanges();

    const judgeValue = fixture.debugElement.queryAll(By.css('.detail-item .value--truncate'))
      .map(debugElement => debugElement.nativeElement as HTMLDivElement)
      .find(element => element.textContent?.includes(longJudge));

    expect(judgeValue).toBeDefined();
    expect(judgeValue?.title).toBe(longJudge);
  });

  it('offers separate copy controls for the IP, port, and full address', () => {
    const copyIp = spyOn(component, 'copyIp');
    const copyPort = spyOn(component, 'copyPort');
    const copyFullAddress = spyOn(component, 'copyFullAddress');
    fixture.detectChanges();

    const copyTargets = fixture.debugElement.queryAll(By.css('.endpoint-copy-target--host, .endpoint-copy-target--port'));
    const copyAll = fixture.debugElement.query(By.css('.endpoint-copy-all'));

    expect(copyTargets.length).toBe(2);
    expect(copyAll).toBeTruthy();

    copyTargets[0].nativeElement.click();
    copyTargets[1].nativeElement.click();
    copyAll.nativeElement.click();

    expect(copyIp).toHaveBeenCalled();
    expect(copyPort).toHaveBeenCalled();
    expect(copyFullAddress).toHaveBeenCalled();
  });

  it('formats hostname and IPv6 routes and hides IP-only lookup links for hostnames', () => {
    component.detail.update(detail => detail ? {...detail, ip: 'gateway.provider.example', port: 3128} : detail);
    expect(component.fullAddress).toBe('gateway.provider.example:3128');
    expect(component.externalLookupLinks).toEqual([]);

    component.detail.update(detail => detail ? {...detail, ip: '2001:db8::1', port: 8080} : detail);
    expect(component.fullAddress).toBe('[2001:db8::1]:8080');
    expect(component.externalLookupLinks.length).toBeGreaterThan(0);
  });
  it('formats authenticated endpoints with escaped credentials before the host', () => {
    component.detail.update(detail => detail ? {
      ...detail, has_auth: true, username: 'user', password: 'pass',
    } : detail);
    expect(component.fullCredentialAddress).toBe('user:pass@127.0.0.1:8080');

    component.detail.update(detail => detail ? {
      ...detail, ip: 'gateway.provider.example', username: 'user@example', password: 'p:a/s?#%',
    } : detail);
    expect(component.fullCredentialAddress)
      .toBe('user%40example:p%3Aa%2Fs%3F%23%25@gateway.provider.example:8080');

    component.detail.update(detail => detail ? {...detail, ip: '2001:db8::1'} : detail);
    expect(component.fullCredentialAddress)
      .toBe('user%40example:p%3Aa%2Fs%3F%23%25@[2001:db8::1]:8080');
  });

  it('keeps auth controls compact on one row with both values visible', async () => {
    component.detail.update(detail => detail ? {
      ...detail,
      has_auth: true,
      username: 'user',
      password: 'a-long-proxy-password-that-must-not-squeeze-out-the-username',
    } : detail);
    fixture.detectChanges();

    await fixture.whenStable();

    const auth = fixture.nativeElement.querySelector('.auth-credentials') as HTMLElement;
    auth.style.width = '160px';
    const values = Array.from(auth.querySelectorAll<HTMLElement>('.copy-value__text'));
    expect(values.length).toBe(2);
    for (const value of values) {
      expect(value.getBoundingClientRect().width).toBeGreaterThan(20);
    }
    const buttons = Array.from(auth.querySelectorAll<HTMLButtonElement>('button'));
    const bounds = buttons.map(button => button.getBoundingClientRect());
    for (const bound of bounds) {
      expect(bound.top).toBeCloseTo(bounds[0].top, 0);
      expect(bound.right).toBeLessThanOrEqual(auth.getBoundingClientRect().right);
    }
    expect(bounds[2].width).toBeLessThan(32);
  });

  it('shows no check result when only obsolete history contains successes', () => {
    component.detail.update(detail => detail ? {...detail, alive: null} : detail);
    component.statistics.set([{id: 99, alive: true, protocol: 'http', attempt: 0, response_time: 1, judge: 'old', anonymity_level: 'elite', created_at: new Date().toISOString(), current: false}]);
    fixture.detectChanges();

    expect(component.latestStatistic).toBeNull();
    const summary = fixture.debugElement.query(By.css('.check-summary')).nativeElement as HTMLElement;
    expect(summary.textContent).toContain('Not checked');
    expect(summary.querySelector('.status-dot.unknown')).not.toBeNull();
  });

  it('loads three days of hourly results and reloads when the range changes', () => {
    expect(hourlyStatistics).toHaveBeenCalledWith(1, 72);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.range-switch__option')) as HTMLButtonElement[];
    expect(buttons.map(button => button.textContent?.trim())).toEqual(['24h', '3d', '7d']);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');

    buttons[2].click();
    fixture.detectChanges();

    expect(hourlyStatistics).toHaveBeenCalledWith(1, 168);
    expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the availability grid and the window totals', () => {
    const now = new Date();
    const since = new Date(now.getTime() - 2 * 3_600_000);
    since.setMinutes(0, 0, 0);
    component.statisticHours.set({since: since.toISOString(), hours: [
      {hour: since.toISOString(), checks: 4, failed: 0, avg_response_time: 100},
      {hour: new Date(since.getTime() + 3_600_000).toISOString(), checks: 4, failed: 4, avg_response_time: 0},
    ]});
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.availability-cell').length % 24).toBe(0);
    expect(element.querySelector('.availability-cell--failed')).not.toBeNull();
    expect(element.querySelector('.availability-cell--current')).not.toBeNull();
    const stats = element.querySelector('.availability-stats')!.textContent!.replace(/\s+/g, ' ');
    expect(stats).toContain('Average 100 ms');
    expect(stats).toContain('Success rate 50 %');
  });
  it('opens an hour card on hover and closes it when the pointer leaves', () => {
    const since = new Date(Date.now() - 2 * 3_600_000);
    since.setMinutes(0, 0, 0);
    component.statisticHours.set({since: since.toISOString(), hours: [
      {hour: since.toISOString(), checks: 3, failed: 2, avg_response_time: 4082},
    ]});
    fixture.detectChanges();

    const cell = fixture.nativeElement.querySelector('.availability-cell--partial') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    const card = document.querySelector('.availability-card') as HTMLElement;
    expect(card).not.toBeNull();
    const text = card.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Checks3');
    expect(text).toContain('Failed2');
    expect(text).toContain('Average4,082ms');
    expect(text).toContain('33% success');

    cell.dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();
    expect(document.querySelector('.availability-card')).toBeNull();
  });
  it('labels the access band and keeps tags on the wide track', () => {
    const access = fixture.nativeElement.querySelector('[aria-labelledby="access-title"]') as HTMLElement;
    expect(access.querySelector('h3')!.textContent).toContain('Access');
    expect(access.querySelector('.overview-band__wide')!.textContent).toContain('Tags');
  });

  it('shows IPGeolocation findings in their own band only when they exist', () => {
    expect(fixture.nativeElement.querySelector('[aria-labelledby="intel-title"]')).toBeNull();

    component.detail.update(detail => detail ? {...detail, ipgeolocation: {
      checked_at: '2026-11-07T18:08:00Z', expires_at: '2026-12-07T18:08:00Z', fresh: true,
      result: {
        ip: '127.0.0.1',
        company: {name: '', type: ''},
        network: {connection_type: ''},
        asn: {as_number: 'AS203273', organization: 'NetCrafters OU', type: ''},
        security: {is_proxy: true, is_vpn: false, is_tor: false, proxy_confidence_score: 80, proxy_last_seen: '', proxy_provider_names: []},
      },
    }} : detail);
    fixture.detectChanges();

    const intel = fixture.nativeElement.querySelector('[aria-labelledby="intel-title"]') as HTMLElement;
    const text = intel.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('IPGeolocation.io');
    expect(text).toContain('Cached');
    expect(text).toContain('NetCrafters OU AS203273');
    expect(text).toContain('80 / 100');
    const network = fixture.nativeElement.querySelector('[aria-labelledby="network-title"]') as HTMLElement;
    expect(network.textContent).not.toContain('Network operator');
  });
});
