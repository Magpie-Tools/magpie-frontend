import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminScraperComponent } from './admin-scraper.component';
import { SettingsService } from '../../services/settings.service';
import { NotificationService } from '../../services/notification-service.service';

class SettingsServiceStub {
  settings$ = of({
    scraper: {
      dynamic_threads: true,
      threads: 250,
      max_threads: 500,
      retries: 2,
      timeout: 7500,
      respect_robots_txt: true,
      scrape_sites: ['https://example.com/proxies.txt'],
      monthly_scrapes_per_workspace: 4320
    },
    proxy_limits: {
      enabled: false,
      max_per_user: 0,
      exclude_admins: true
    }
  });

  saveGlobalSettings() {
    return of({ message: 'saved' });
  }

  requeueAllScrapeSources() {
    return of({ message: 'requeued', source_count: 0 });
  }
}

class NotificationServiceStub {
  showError = jasmine.createSpy('showError');
  showSuccess = jasmine.createSpy('showSuccess');
}

describe('AdminScraperComponent', () => {
  let component: AdminScraperComponent;
  let fixture: ComponentFixture<AdminScraperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminScraperComponent],
      providers: [
        { provide: SettingsService, useClass: SettingsServiceStub },
        { provide: NotificationService, useClass: NotificationServiceStub }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminScraperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the monthly scrape allowance instead of a scrape interval', () => {
    expect(component.settingsForm.get('scraper_timer')).toBeNull();
    expect(component.settingsForm.get('monthly_scrapes_per_workspace')?.value).toBe(4320);
    // 4,320 scrapes over 30 days for ten sources is one fetch every 100 minutes.
    expect(component.scraperCadenceExample).toContain('every 1.7 hours');
  });

  it('hides the monthly figure when the default has no limit', () => {
    component.settingsForm.get('unlimited_monthly_scrapes')?.setValue(true);
    fixture.detectChanges();
    expect(component.monthlyScrapesLabel).toBe('No limit');
    expect((fixture.nativeElement as HTMLElement).querySelector('#monthly_scrapes')).toBeNull();
  });
});
