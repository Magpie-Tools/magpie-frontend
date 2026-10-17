import {ComponentFixture, TestBed} from '@angular/core/testing';
import {of} from 'rxjs';

import {RotatingProxiesComponent} from './rotating-proxies.component';
import {HttpService} from '../services/http.service';
import {NotificationService} from '../services/notification-service.service';
import {WorkspaceService} from '../services/workspace.service';
import {RotatingProxy} from '../models/RotatingProxy';
import {UserSettings} from '../models/UserSettings';

const defaultSettings: UserSettings = {
  http_protocol: true,
  https_protocol: true,
  socks4_protocol: false,
  socks5_protocol: false,
  timeout: 5000,
  retries: 2,
  UseHttpsForSocks: true,
  transport_protocol: 'tcp',
  auto_remove_failing_proxies: false,
  auto_remove_failure_threshold: 3,
  failure_action: 'pause',
  judges: [],
  scraping_sources: [],
};

const availableInstance = {
  id: 'instance-1', name: 'Test instance', region: 'Test',
  port_start: 19000, port_end: 19010, used_ports: 0, free_ports: 11, total_ports: 11,
};

const httpServiceMock = {
  getRotatingProxies: jasmine.createSpy().and.returnValue(of([])),
  getRotatingProxyInstances: jasmine.createSpy().and.returnValue(of([])),
  getUserSettings: jasmine.createSpy().and.returnValue(of(defaultSettings)),
  createRotatingProxy: jasmine.createSpy().and.returnValue(of({
    id: 1,
    name: 'Test rotator',
    protocol: 'http',
    listen_protocol: 'http',
    transport_protocol: 'tcp',
    listen_transport_protocol: 'tcp',
    alive_proxy_count: 0,
    listen_port: 19000,
    auth_required: false,
    reputation_labels: ['good', 'neutral'],
    created_at: new Date().toISOString(),
  })),
  deleteRotatingProxy: jasmine.createSpy().and.returnValue(of(void 0)),
  getNextRotatingProxy: jasmine.createSpy().and.returnValue(of({
    proxy_id: 1,
    ip: '127.0.0.1',
    port: 8000,
    has_auth: false,
    protocol: 'http',
  })),
};

describe('RotatingProxiesComponent', () => {
  let component: RotatingProxiesComponent;
  let fixture: ComponentFixture<RotatingProxiesComponent>;

  beforeEach(async () => {
    httpServiceMock.getUserSettings.and.returnValue(of(defaultSettings));
    httpServiceMock.getRotatingProxyInstances.and.returnValue(of([]));
    httpServiceMock.createRotatingProxy.calls.reset();

    await TestBed.configureTestingModule({
      imports: [RotatingProxiesComponent],
      providers: [
        NotificationService,
        {provide: HttpService, useValue: httpServiceMock},
        {provide: WorkspaceService, useValue: {canOperate: () => true}},
      ]
    })
    .compileComponents();

    TestBed.inject(NotificationService);

    fixture = TestBed.createComponent(RotatingProxiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('warns without blocking creation when all Default checker protocols are disabled', () => {
    httpServiceMock.getUserSettings.and.returnValue(of({
      ...defaultSettings, http_protocol: false, https_protocol: false,
    }));
    httpServiceMock.getRotatingProxyInstances.and.returnValue(of([availableInstance]));
    component.loadInitialData();
    component.createForm.patchValue({name: 'Ready for later', protocol: 'socks5'});
    fixture.detectChanges();

    const warning = fixture.nativeElement.querySelector('.form-alert[role="status"]') as HTMLElement;
    expect(warning.textContent).toContain('You can still create a rotator');
    expect(warning.textContent).toContain('healthy upstream');
    expect(warning.textContent).toContain('selected protocol');
    expect(component.protocolOptions().map(option => option.value)).toEqual(['http', 'https', 'socks4', 'socks5']);
    for (const field of ['name', 'protocol', 'listenProtocol', 'transportProtocol', 'listenTransportProtocol']) {
      expect(component.createForm.get(field)?.enabled).withContext(field).toBeTrue();
    }

    const submit = fixture.nativeElement.querySelector('.create-button') as HTMLButtonElement;
    expect(submit.disabled).toBeFalse();
    submit.click();

    expect(httpServiceMock.createRotatingProxy).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      name: 'Ready for later', instance_id: 'instance-1', protocol: 'socks5',
    }));
  });

  it('offers protocols outside Default checks and preserves the enabled initial selection', () => {
    httpServiceMock.getUserSettings.and.returnValue(of({...defaultSettings, http_protocol: false}));
    httpServiceMock.getRotatingProxyInstances.and.returnValue(of([availableInstance]));
    component.createForm.patchValue({protocol: ''});
    component.loadInitialData();
    fixture.detectChanges();

    expect(component.createForm.get('protocol')?.value).toBe('https');
    expect(component.protocolOptions().map(option => option.value)).toContain('socks5');
    expect(fixture.nativeElement.querySelector('.form-alert[role="status"]')).toBeNull();

    component.createForm.patchValue({name: 'Tag checked pool', protocol: 'socks5'});
    component.loadInitialData();
    expect(component.createForm.get('protocol')?.value).toBe('socks5');
    component.createRotator();

    expect(httpServiceMock.createRotatingProxy).toHaveBeenCalledOnceWith(jasmine.objectContaining({protocol: 'socks5'}));
  });

  it('still requires a valid name and an instance with free ports', () => {
    httpServiceMock.getUserSettings.and.returnValue(of({
      ...defaultSettings, http_protocol: false, https_protocol: false,
    }));
    component.loadInitialData();
    component.createForm.patchValue({name: 'Waiting for a port'});
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector('.create-button') as HTMLButtonElement;
    expect(submit.disabled).toBeTrue();
    component.createRotator();
    expect(httpServiceMock.createRotatingProxy).not.toHaveBeenCalled();

    httpServiceMock.getRotatingProxyInstances.and.returnValue(of([availableInstance]));
    component.loadInitialData();
    component.createForm.patchValue({name: ''});
    fixture.detectChanges();
    expect(submit.disabled).toBeTrue();
    component.createRotator();
    expect(httpServiceMock.createRotatingProxy).not.toHaveBeenCalled();
  });

  it('brackets IPv6 listener addresses in endpoints and connection URLs', () => {
    const rotator = {
      id: 2,
      name: 'IPv6 rotator',
      protocol: 'http',
      listen_protocol: 'http',
      alive_proxy_count: 1,
      listen_port: 19001,
      listen_host: '2001:db8::5',
      auth_required: false,
      created_at: new Date().toISOString(),
    };

    expect(component.rotatorEndpoint(rotator)).toBe('[2001:db8::5]:19001');
    expect(component.rotatorConnectionString(rotator)).toBe('http://[2001:db8::5]:19001');
  });

  it('opens connection details from a managed endpoint card', () => {
    const rotator = createRotatorFixture({name: 'Production pool', alive_proxy_count: 18});
    component.rotatingProxies.set([rotator]);
    component.hasLoaded.set(true);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.rotator-card') as HTMLElement;
    expect(card.textContent).toContain('Production pool');
    expect(card.textContent).toContain('18');

    const detailsButton = card.querySelector('.text-action') as HTMLButtonElement;
    detailsButton.click();

    expect(component.selectedRotator()).toBe(rotator);
    expect(component.detailsVisible()).toBeTrue();
  });

  it('keeps closed select labels readable beside their dropdown trigger', () => {
    const select = fixture.nativeElement.querySelector('hlm-select [data-slot="select-trigger"]') as HTMLElement;
    const label = select.querySelector('span') as HTMLElement;
    const trigger = select.querySelector('ng-icon') as HTMLElement;
    const selectStyle = getComputedStyle(select);
    const labelStyle = getComputedStyle(label);
    const triggerStyle = getComputedStyle(trigger);

    expect(selectStyle.display).toBe('flex');
    expect(selectStyle.flexWrap).toBe('nowrap');
    expect(labelStyle.flexGrow).toBe('1');
    expect(labelStyle.whiteSpace).toBe('nowrap');
    expect(triggerStyle.flexShrink).toBe('0');
  });

  it('gives the closed reputation multiselect label the available field width', () => {
    const multiselect = fixture.nativeElement.querySelector('hlm-select-multiple [data-slot="select-trigger"]') as HTMLElement;
    const labelContainer = multiselect.querySelector('span') as HTMLElement;
    const label = multiselect.querySelector('span') as HTMLElement;
    const trigger = multiselect.querySelector('ng-icon') as HTMLElement;
    multiselect.style.width = '320px';

    const containerStyle = getComputedStyle(labelContainer);
    const labelStyle = getComputedStyle(label);
    const labelRect = label.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();

    expect(containerStyle.flexGrow).toBe('1');
    expect(labelStyle.width).not.toBe('1%');
    expect(labelRect.width).toBeGreaterThan(triggerRect.width * 2);
    expect(triggerRect.left).toBeGreaterThan(labelRect.left);
  });
});

function createRotatorFixture(overrides: Partial<RotatingProxy> = {}): RotatingProxy {
  return {
    id: 1,
    name: 'Rotator',
    instance_id: 'instance-1',
    instance_name: 'Primary',
    instance_region: 'eu-central',
    protocol: 'http',
    listen_protocol: 'http',
    transport_protocol: 'tcp',
    listen_transport_protocol: 'tcp',
    alive_proxy_count: 0,
    listen_port: 19000,
    listen_host: '127.0.0.1',
    auth_required: false,
    reputation_labels: ['good', 'neutral'],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
