import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import {of} from 'rxjs';
import { AddProxiesComponent } from './add-proxies.component';
import {HttpService} from '../../../services/http.service';

describe('AddProxiesComponent', () => {
  let component: AddProxiesComponent;
  let fixture: ComponentFixture<AddProxiesComponent>;
  let httpServiceStub: {
    getProxyTags: jasmine.Spy;
    uploadProxies: jasmine.Spy;
  };

  beforeEach(async () => {
    httpServiceStub = {
      getProxyTags: jasmine.createSpy('getProxyTags').and.returnValue(of([])),
      uploadProxies: jasmine.createSpy('uploadProxies').and.returnValue(of({
        proxyCount: 1,
        details: {
          submittedCount: 1,
          parsedCount: 1,
          invalidFormatCount: 0,
          invalidIpCount: 0,
          invalidPortCount: 0,
          blacklistedCount: 0,
          processingMs: 1,
        },
      })),
    };

    await TestBed.configureTestingModule({
      imports: [AddProxiesComponent],
      providers: [
        MessageService,
        {provide: HttpService, useValue: httpServiceStub},
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddProxiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('counts bracketed IPv6 proxies and authentication correctly', () => {
    component.onTextareaChange([
      '192.0.2.1:8080',
      '[2001:db8::1]:8080',
      'user:pass@[2001:db8::2]:8080',
      '[2001:db8::3]:8080:user:pass',
    ].join('\n'));

    expect(component.getProxiesWithoutAuthCount()).toBe(2);
    expect(component.getProxiesWithAuthCount()).toBe(2);
    expect(component.getUniqueProxiesCount()).toBe(4);
  });

  it('counts provider hostname routes and authentication correctly', () => {
    component.onTextareaChange([
      'gateway.provider.example:8080',
      'user:pass@gateway2.provider.example:8080',
      'gateway3.provider.example:8080:user:pass',
    ].join('\n'));

    expect(component.getProxiesWithoutAuthCount()).toBe(1);
    expect(component.getProxiesWithAuthCount()).toBe(2);
    expect(component.getUniqueProxiesCount()).toBe(3);
  });

  it('applies every selected tag when importing proxies', () => {
    component.onTextareaChange('gateway.provider.example:8080');
    component.onTagSelectionChange([2, 5]);

    component.submitProxies();

    expect(httpServiceStub.uploadProxies).toHaveBeenCalledWith(jasmine.any(FormData), [2, 5]);
  });
});
