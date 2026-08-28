import {ComponentFixture, TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {MessageService} from 'primeng/api';

import {RotatingProxiesComponent} from './rotating-proxies.component';
import {HttpService} from '../services/http.service';
import {NotificationService} from '../services/notification-service.service';
import {WorkspaceService} from '../services/workspace.service';
import {RotatingProxy} from '../models/RotatingProxy';

const httpServiceMock = {
  getRotatingProxies: jasmine.createSpy().and.returnValue(of([])),
  getRotatingProxyInstances: jasmine.createSpy().and.returnValue(of([])),
  getUserSettings: jasmine.createSpy().and.returnValue(of({
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
    judges: [],
    scraping_sources: [],
  })),
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
    await TestBed.configureTestingModule({
      imports: [RotatingProxiesComponent],
      providers: [
        MessageService,
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

  it('summarizes the managed pool and available instance capacity', () => {
    component.rotatingProxies.set([
      createRotatorFixture({id: 1, alive_proxy_count: 7}),
      createRotatorFixture({id: 2, alive_proxy_count: 5}),
    ]);
    component.instanceOptions.set([
      {label: 'Berlin', value: 'berlin', freePorts: 3},
      {label: 'Frankfurt', value: 'frankfurt', freePorts: 4},
    ]);

    expect(component.totalMatchingProxies()).toBe(12);
    expect(component.availablePortCount()).toBe(7);
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
