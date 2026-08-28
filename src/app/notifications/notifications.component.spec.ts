import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NotificationsComponent } from './notifications.component';
import { ReleaseFeed, ReleaseNote, UpdateNotificationService } from '../services/update-notification.service';

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let fixture: ComponentFixture<NotificationsComponent>;
  let updatesMock: jasmine.SpyObj<UpdateNotificationService>;
  const release: ReleaseNote = {
    id: 42,
    tagName: 'v2.4.0',
    title: 'Faster route checks',
    body: '## Improved\n\n- Reduced queue overhead',
    htmlUrl: 'https://github.com/magpie/releases/v2.4.0',
    publishedAt: '2026-08-20T10:00:00Z',
    prerelease: false
  };
  const feed: ReleaseFeed = {
    releases: [release],
    newSinceLastSeen: [release],
    lastSeenTag: 'v2.3.0',
    latestTag: 'v2.4.0',
    backendBuild: { buildVersion: 'v2.4.0', builtAt: '2026-08-20T09:30:00Z' }
  };

  beforeEach(async () => {
    updatesMock = jasmine.createSpyObj<UpdateNotificationService>('UpdateNotificationService', [
      'fetchReleaseFeed',
      'markAllSeen'
    ]);
    updatesMock.fetchReleaseFeed.and.returnValue(of(feed));

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

  it('renders the release overview and archive', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(fixture.nativeElement.querySelector('.unread-count')?.textContent?.trim()).toBe('1');
    expect(fixture.nativeElement.querySelector('.unread-summary span')?.textContent?.trim()).toBe('unread release');
    expect(text).toContain('Faster route checks');
    expect(text).toContain('v2.4.0');
    expect(fixture.nativeElement.querySelectorAll('.archive-row').length).toBe(1);
  });

  it('marks the latest release as read without clearing the archive', () => {
    component.markAllSeen();
    fixture.detectChanges();

    expect(updatesMock.markAllSeen).toHaveBeenCalledOnceWith('v2.4.0');
    expect(component.newReleases()).toEqual([]);
    expect(component.lastSeenTag()).toBe('v2.4.0');
    expect(component.allReleases()).toEqual([release]);
  });

  it('opens a release and renders its markdown', () => {
    component.openReleaseDialog(release);
    fixture.detectChanges();

    expect(component.releaseDialogVisible()).toBeTrue();
    expect(component.selectedRelease()).toBe(release);
    expect(component.selectedReleaseMarkdown()).toContain('<h2>Improved</h2>');
    expect(component.selectedReleaseMarkdown()).toContain('<li>Reduced queue overhead</li>');
  });
});
