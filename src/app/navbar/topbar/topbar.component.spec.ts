import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TopbarComponent } from './topbar.component';
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
});
