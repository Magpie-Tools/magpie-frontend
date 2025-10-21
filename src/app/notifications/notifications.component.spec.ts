import {ComponentFixture, TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {NotificationsComponent} from './notifications.component';
import {UpdateNotificationService} from '../services/update-notification.service';

class MockUpdateNotificationService {
  hasUpdate = signal(false);
  latestRemoteCommit = signal(null);
  localCommit = signal<string | null>('dev');
  start() {}
  openLatestCommit() {}
}

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let fixture: ComponentFixture<NotificationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [{ provide: UpdateNotificationService, useClass: MockUpdateNotificationService }]
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
