import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MessageService} from 'primeng/api';
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
        MessageService,
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
});
