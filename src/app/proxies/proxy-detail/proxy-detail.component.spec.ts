import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProxyDetailComponent} from './proxy-detail.component';
import {ActivatedRoute, convertToParamMap} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {of} from 'rxjs';
import {By} from '@angular/platform-browser';
import {HttpService} from '../../services/http.service';
import {ProxyDetail} from '../../models/ProxyDetail';
import {ProxyStatistic} from '../../models/ProxyStatistic';

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

  it('shows an empty latest-check summary before any results exist', () => {
    const summary = fixture.debugElement.query(By.css('.check-summary')).nativeElement as HTMLElement;
    expect(summary.textContent).toContain('Not checked');
    expect(summary.textContent).toContain('No check results yet');
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

    expect(component.overallAlive).toBeTrue();
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

  it('keeps auth controls compact on one row with both values visible', () => {
    component.detail.update(detail => detail ? {
      ...detail,
      has_auth: true,
      username: 'user',
      password: 'a-long-proxy-password-that-must-not-squeeze-out-the-username',
    } : detail);
    fixture.detectChanges();

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

});
