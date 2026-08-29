import { ComponentFixture, TestBed } from '@angular/core/testing';

import {buildTopbarBreadcrumbs, TopbarComponent} from './topbar.component';
import {provideRouter} from '@angular/router';
import {signal} from '@angular/core';
import {of} from 'rxjs';
import {WorkspaceService} from '../../services/workspace.service';
import {NotificationService} from '../../services/notification-service.service';
import {WorkspaceInvitationService} from '../../services/workspace-invitation.service';

describe('TopbarComponent', () => {
  let component: TopbarComponent;
  let fixture: ComponentFixture<TopbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopbarComponent],
      providers: [
        provideRouter([]),
        {
          provide: WorkspaceService,
          useValue: {
            workspaces: signal([]),
            current: signal(null),
            loading: signal(false),
            load: () => of([]),
            switchTo: () => of(undefined),
            capacityLabel: () => '',
          },
        },
        {
          provide: WorkspaceInvitationService,
          useValue: {
            pendingCount: signal(0),
            load: () => of([]),
          },
        },
        {provide: NotificationService, useValue: {showError: jasmine.createSpy('showError')}},
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TopbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('builds a singular proxy breadcrumb for detail routes', () => {
    expect(buildTopbarBreadcrumbs('/proxies/37530?sourceId=2')).toEqual([
      {label: 'Proxy', routerLink: '/proxies'},
      {label: '37530'},
    ]);
  });

  it('preserves every route layer and product casing', () => {
    expect(buildTopbarBreadcrumbs('/plugins/geolite')).toEqual([
      {label: 'Plugins', routerLink: '/plugins'},
      {label: 'GeoLite'},
    ]);

    expect(buildTopbarBreadcrumbs('/global/plugins/abuseipdb')).toEqual([
      {label: 'Global', routerLink: '/global'},
      {label: 'Plugins', routerLink: '/global/plugins'},
      {label: 'AbuseIPDB'},
    ]);
  });
});
