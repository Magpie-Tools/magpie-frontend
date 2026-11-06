import {provideZonelessChangeDetection} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {BehaviorSubject} from 'rxjs';
import {AdminBlacklistComponent} from './admin-blacklist.component';
import {GlobalSettings} from '../../models/GlobalSettings';
import {SettingsService} from '../../services/settings.service';
import {NotificationService} from '../../services/notification-service.service';

type BlacklistSettings = Pick<GlobalSettings, 'blacklist_timer' | 'blacklist_sources' | 'website_blacklist'>;

const loadedSettings: BlacklistSettings = {
  blacklist_timer: {days: 0, hours: 6, minutes: 0, seconds: 0},
  blacklist_sources: ['https://example.com/first.txt', 'https://example.com/second.txt'],
  website_blacklist: ['blocked.example.com', 'another.example.com'],
};

describe('AdminBlacklistComponent', () => {
  let component: AdminBlacklistComponent;
  let fixture: ComponentFixture<AdminBlacklistComponent>;
  let settings: BehaviorSubject<BlacklistSettings | undefined>;

  beforeEach(async () => {
    settings = new BehaviorSubject<BlacklistSettings | undefined>(undefined);
    await TestBed.configureTestingModule({
      imports: [AdminBlacklistComponent],
      providers: [
        provideZonelessChangeDetection(),
        {provide: SettingsService, useValue: {settings$: settings.asObservable()}},
        {provide: NotificationService, useValue: {
          showSuccess: jasmine.createSpy('showSuccess'),
          showError: jasmine.createSpy('showError'),
        }},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminBlacklistComponent);
    component = fixture.componentInstance;
  });

  it('creates an empty editor while settings are loading', async () => {
    await fixture.whenStable();
    expect(component).toBeTruthy();
    expect(component.sources.value).toEqual(['']);
    expect(component.blockedSites.value).toEqual(['']);
  });

  it('renders blacklist entries arriving after the initial page load without navigation', async () => {
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector<HTMLInputElement>('#blacklist-source-0')!.value).toBe('');
    expect(host.querySelector<HTMLInputElement>('#blocked-site-0')!.value).toBe('');

    settings.next(loadedSettings);
    await fixture.whenStable();

    expect(Array.from(host.querySelectorAll<HTMLInputElement>('input[id^="blacklist-source-"]'), input => input.value))
      .toEqual(loadedSettings.blacklist_sources);
    expect(Array.from(host.querySelectorAll<HTMLInputElement>('input[id^="blocked-site-"]'), input => input.value))
      .toEqual(loadedSettings.website_blacklist);
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBeTrue();
  });

  it('renders cached blacklist settings on the first visit', async () => {
    settings.next(loadedSettings);
    await fixture.whenStable();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector<HTMLInputElement>('#blacklist-source-1')!.value)
      .toBe(loadedSettings.blacklist_sources[1]);
    expect(host.querySelector<HTMLInputElement>('#blocked-site-1')!.value)
      .toBe(loadedSettings.website_blacklist[1]);
  });

  it('keeps enforcement path captions from overlapping in a narrow card', async () => {
    await fixture.whenStable();
    const flow = fixture.nativeElement.querySelector('.enforcement-path') as HTMLElement;
    flow.style.width = '300px';
    const captions = Array.from(flow.querySelectorAll<HTMLElement>('small')).map(caption => caption.getBoundingClientRect());
    expect(captions.length).toBe(3);
    for (let index = 1; index < captions.length; index++) {
      expect(captions[index - 1].right).toBeLessThanOrEqual(captions[index].left + 0.5);
    }
  });
});
