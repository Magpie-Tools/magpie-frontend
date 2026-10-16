import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProxyDetailComponent} from './proxy-detail.component';
import {ActivatedRoute, convertToParamMap} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {of} from 'rxjs';
import {By} from '@angular/platform-browser';
import {HttpService} from '../../services/http.service';
import {ProxyDetail} from '../../models/ProxyDetail';
import {ProxyStatistic} from '../../models/ProxyStatistic';
import {gsap} from 'gsap';
import {CountryHoverCardComponent} from '../../shared/ui/country-hover-card.component';

describe('ProxyDetailComponent', () => {
  let component: ProxyDetailComponent;
  let fixture: ComponentFixture<ProxyDetailComponent>;

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

    const httpServiceStub = {
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

  it('shows the empty trend and renders a responsive SVG when a latest check arrives', async () => {
    expect(fixture.nativeElement.querySelector('.mini-chart').textContent).toContain('No response-time trend yet.');
    component.detail.update(detail => detail ? {...detail, latest_statistic: {
      id: 10, response_time: 120, created_at: '2026-10-16T12:01:00Z',
      alive: true, attempt: 1, protocol: 'http', anonymity_level: 'elite', judge: 'https://judge.example',
    }} : detail);
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

    const copyTargets = fixture.debugElement.queryAll(By.css('.endpoint-copy-target'));
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
    // Compare bounds after the page has finished scaling into place.
    const header = fixture.nativeElement.querySelector('.detail-context');
    gsap.getTweensOf(header).forEach(entrance => entrance.progress(1));

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

});
