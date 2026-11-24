import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { AdminScraperComponent, findScrapeSourceIssues } from './admin-scraper.component';
import { SettingsService } from '../../services/settings.service';
import { NotificationService } from '../../services/notification-service.service';
import { GlobalSettings } from '../../models/GlobalSettings';

function makeSettings(overrides?: {
  scraper?: Partial<GlobalSettings['scraper']>;
  proxy_limits?: Partial<GlobalSettings['proxy_limits']>;
  website_blacklist?: string[];
}): GlobalSettings {
  return {
    protocols: { http: true, https: true, socks4: false, socks5: false },
    checker: {} as GlobalSettings['checker'],
    scraper: {
      dynamic_threads: true,
      threads: 250,
      max_threads: 500,
      retries: 2,
      timeout: 7500,
      respect_robots_txt: true,
      scrape_sites: ['https://example.com/proxies.txt'],
      monthly_scrapes_per_workspace: 4320,
      unlimited_monthly_scrapes: false,
      ...overrides?.scraper,
    },
    proxy_limits: {
      enabled: false,
      max_per_user: 0,
      exclude_admins: true,
      ...overrides?.proxy_limits,
    },
    plugins: {} as GlobalSettings['plugins'],
    blacklist_timer: { days: 0, hours: 6, minutes: 0, seconds: 0 },
    blacklist_sources: [],
    website_blacklist: overrides?.website_blacklist ?? [],
  };
}

class SettingsServiceStub {
  settings$ = new BehaviorSubject<GlobalSettings | undefined>(makeSettings());
  saveGlobalSettings = jasmine.createSpy('saveGlobalSettings').and.returnValue(of({ message: 'saved' }));
  requeueAllScrapeSources = jasmine.createSpy('requeueAllScrapeSources').and.returnValue(of({ message: 'requeued', source_count: 12 }));
}

class NotificationServiceStub {
  showError = jasmine.createSpy('showError');
  showSuccess = jasmine.createSpy('showSuccess');
}

describe('AdminScraperComponent', () => {
  let component: AdminScraperComponent;
  let fixture: ComponentFixture<AdminScraperComponent>;
  let settingsService: SettingsServiceStub;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminScraperComponent],
      providers: [
        { provide: SettingsService, useClass: SettingsServiceStub },
        { provide: NotificationService, useClass: NotificationServiceStub },
      ],
    }).compileComponents();

    settingsService = TestBed.inject(SettingsService) as unknown as SettingsServiceStub;
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
    expect(component.settingsForm.valid).toBeTrue();
  });

  it('switches concurrency input between dynamic max threads and fixed threads', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#scraper_max_threads')).not.toBeNull();
    expect(el.querySelector('#scraper_threads')).toBeNull();

    component.setDynamicThreads(false);
    fixture.detectChanges();
    expect(el.querySelector('#scraper_threads')).not.toBeNull();
    expect(el.querySelector('#scraper_max_threads')).toBeNull();
    expect(component.scraperThreadLimit).toBe(250);
  });

  it('shows proxy cap inline controls only when enabled', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.limit-sentence')).toBeNull();

    component.settingsForm.get('proxy_limit_enabled')?.setValue(true);
    fixture.detectChanges();
    expect(el.querySelector('.limit-sentence')).not.toBeNull();
    expect(el.querySelector('#proxy_limit_max_per_user')).not.toBeNull();
  });

  it('adds sources from the bottom input, removes to empty state, and discards changes', () => {
    component.selectTab('sources');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.entry').length).toBe(1);

    component.newSource.setValue('  https://proxies.example.org/list.txt?type=http  ');
    component.addScrapeSite();
    fixture.detectChanges();
    expect(component.scrapeSites.length).toBe(2);
    expect(component.scrapeSites.at(1).value).toBe('https://proxies.example.org/list.txt?type=http');
    expect(component.newSource.value).toBe('');
    expect(component.settingsForm.dirty).toBeTrue();

    component.removeScrapeSite(1);
    component.removeScrapeSite(0);
    fixture.detectChanges();
    expect(component.scrapeSites.length).toBe(0);
    expect(el.querySelector('.entry-empty')).not.toBeNull();

    component.newSource.setValue('https://unsaved.example.com/list.txt');
    component.discardChanges();
    fixture.detectChanges();
    expect(component.scrapeSites.length).toBe(1);
    expect(component.newSource.value).toBe('');
    expect(component.settingsForm.dirty).toBeFalse();
  });

  it('flags invalid, duplicate, and blacklisted scrape sources and blocks saving', () => {
    const issues = findScrapeSourceIssues(
      [
        'https://example.com/a.txt',
        'not-a-url',
        'https://example.com/a.txt',
        'https://sub.blocked.test/list.txt',
      ],
      ['blocked.test'],
    );
    expect(issues.count).toBe(3);
    expect(issues.entries).toEqual([
      null,
      'Not an http or https URL',
      'Listed twice',
      'sub.blocked.test is on the website blacklist',
    ]);

    component.selectTab('sources');
    component.newSource.setValue('ftp://invalid.example/list.txt');
    component.addScrapeSite();
    fixture.detectChanges();
    expect(component.sourceIssues.count).toBe(1);
    expect(component.canSave).toBeFalse();
  });

  it('submits updated settings and resets dirty state', () => {
    component.settingsForm.get('scraper_retries')?.setValue(4);
    component.settingsForm.get('scraper_retries')?.markAsDirty();
    fixture.detectChanges();

    expect(component.unsavedSummary).toBe('Unsaved changes to Scraper engine');
    component.onSubmit();
    expect(settingsService.saveGlobalSettings).toHaveBeenCalled();
    expect(component.settingsForm.dirty).toBeFalse();
  });
});
