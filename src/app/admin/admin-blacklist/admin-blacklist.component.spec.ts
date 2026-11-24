import {provideZonelessChangeDetection} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {BehaviorSubject, of} from 'rxjs';
import {AdminBlacklistComponent, findBlacklistIssues} from './admin-blacklist.component';
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
  let saveGlobalSettings: jasmine.Spy;

  const host = () => fixture.nativeElement as HTMLElement;
  const values = (selector: string) =>
    Array.from(host().querySelectorAll<HTMLInputElement>(selector), input => input.value);
  const saveButton = () => host().querySelector<HTMLButtonElement>('button[type="submit"]')!;

  beforeEach(async () => {
    settings = new BehaviorSubject<BlacklistSettings | undefined>(undefined);
    saveGlobalSettings = jasmine.createSpy('saveGlobalSettings').and.returnValue(of({message: 'Saved'}));
    await TestBed.configureTestingModule({
      imports: [AdminBlacklistComponent],
      providers: [
        provideZonelessChangeDetection(),
        {provide: SettingsService, useValue: {settings$: settings.asObservable(), saveGlobalSettings}},
        {provide: NotificationService, useValue: {
          showSuccess: jasmine.createSpy('showSuccess'),
          showError: jasmine.createSpy('showError'),
        }},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminBlacklistComponent);
    component = fixture.componentInstance;
  });

  it('shows empty lists while settings are loading', async () => {
    await fixture.whenStable();
    expect(component.sources.value).toEqual([]);
    expect(component.blockedSites.value).toEqual([]);
    expect(host().querySelectorAll('.entry-empty').length).toBe(2);
  });

  it('renders blacklist entries arriving after the initial page load without navigation', async () => {
    await fixture.whenStable();
    settings.next(loadedSettings);
    await fixture.whenStable();

    expect(values('input[id^="blacklist-source-"]')).toEqual(loadedSettings.blacklist_sources);
    expect(values('input[id^="blocked-site-"]')).toEqual(loadedSettings.website_blacklist);
    expect(saveButton().disabled).toBeTrue();
  });

  it('adds and removes entries and saves them', async () => {
    settings.next(loadedSettings);
    await fixture.whenStable();

    component.newSource.setValue('  https://example.org/drop.txt ');
    component.addSource();
    component.removeBlockedSite(0);
    await fixture.whenStable();

    expect(values('input[id^="blacklist-source-"]')).toEqual([...loadedSettings.blacklist_sources, 'https://example.org/drop.txt']);
    expect(values('input[id^="blocked-site-"]')).toEqual(['another.example.com']);
    expect(component.newSource.value).toBe('');
    expect(saveButton().disabled).toBeFalse();

    saveButton().click();
    expect(saveGlobalSettings).toHaveBeenCalledWith(jasmine.objectContaining({
      blacklist_sources: [...loadedSettings.blacklist_sources, 'https://example.org/drop.txt'],
      website_blacklist: ['another.example.com'],
    }));
  });

  it('blocks saving while an entry has a problem and names it', async () => {
    settings.next(loadedSettings);
    await fixture.whenStable();

    component.newSource.setValue('https://cdn.blocked.example.com/list.txt');
    component.addSource();
    await fixture.whenStable();

    expect(host().textContent).toContain('cdn.blocked.example.com is on the website blacklist');
    expect(saveButton().disabled).toBeTrue();

    component.removeSource(2);
    await fixture.whenStable();
    expect(saveButton().disabled).toBeFalse();
  });

  it('discards unsaved changes', async () => {
    settings.next(loadedSettings);
    await fixture.whenStable();

    component.removeSource(0);
    component.discardChanges();
    await fixture.whenStable();

    expect(values('input[id^="blacklist-source-"]')).toEqual(loadedSettings.blacklist_sources);
    expect(component.form.dirty).toBeFalse();
  });
});

describe('findBlacklistIssues', () => {
  it('flags invalid, duplicate, and blocked sources', () => {
    const issues = findBlacklistIssues(
      ['https://a.example/list.txt', 'a.example/list.txt', 'https://a.example/list.txt', 'https://raw.githubusercontent.com/x.txt', ''],
      ['githubusercontent.com'],
    );
    expect(issues.sources).toEqual([
      null,
      'Not an http or https URL',
      'Listed twice',
      'raw.githubusercontent.com is on the website blacklist',
      null,
    ]);
    expect(issues.total).toBe(3);
  });

  it('compares websites by hostname like the backend', () => {
    const issues = findBlacklistIssues([], ['Example.com', 'https://example.com/path', 'europa eu', 'www.example.com']);
    expect(issues.sites).toEqual([null, 'Listed twice', 'Not a hostname', null]);
  });
});
