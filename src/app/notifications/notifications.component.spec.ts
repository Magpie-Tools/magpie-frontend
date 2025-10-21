import {ComponentFixture, TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {NotificationsComponent} from './notifications.component';
import {VersionService} from '../services/version.service';

class MockVersionService {
  hasUpdate = signal(false);
  availableVersion = signal<string | null>(null);
  acknowledgeUpdate() {}
}

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let fixture: ComponentFixture<NotificationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [{ provide: VersionService, useClass: MockVersionService }]
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
