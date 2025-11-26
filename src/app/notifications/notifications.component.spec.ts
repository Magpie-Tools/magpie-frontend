import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NotificationsComponent } from './notifications.component';
import { UpdateNotificationService } from '../services/update-notification.service';

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let fixture: ComponentFixture<NotificationsComponent>;
  const updatesMock = {
    fetchReleaseFeed: () =>
      of({
        releases: [],
        newSinceLastSeen: [],
        lastSeenTag: null,
        latestTag: null,
        backendBuild: { buildVersion: 'test', builtAt: 'now' }
      }),
    markAllSeen: () => {}
  } as Partial<UpdateNotificationService>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [{ provide: UpdateNotificationService, useValue: updatesMock }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
