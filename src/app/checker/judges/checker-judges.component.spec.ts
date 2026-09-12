import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideZonelessChangeDetection} from '@angular/core';

import {BehaviorSubject, of} from 'rxjs';
import {CheckerJudgesComponent} from './checker-judges.component';
import {UserSettings} from '../../models/UserSettings';
import {SettingsService} from '../../services/settings.service';
import {WorkspaceService} from '../../services/workspace.service';
import {NotificationService} from '../../services/notification-service.service';

class SettingsServiceStub {
  private settings: UserSettings | undefined = {
    http_protocol: true,
    https_protocol: true,
    socks4_protocol: false,
    socks5_protocol: false,
    timeout: 7500,
    retries: 2,
    UseHttpsForSocks: true,
    transport_protocol: 'tcp',
    auto_remove_failing_proxies: false,
    auto_remove_failure_threshold: 3,
    judges: [{ url: 'https://example.com', regex: 'default' }],
    scraping_sources: []
  };
  private readonly settingsSubject = new BehaviorSubject(this.settings);
  userSettings$ = this.settingsSubject.asObservable();

  getUserSettings(): UserSettings | undefined {
    return this.settings;
  }

  setUserSettings(settings: UserSettings | undefined): void {
    this.settings = settings;
    this.settingsSubject.next(settings);
  }

  saveUserSettings(_: any) {
    return of({ message: 'saved' });
  }
}

describe('CheckerJudgesComponent', () => {
  let component: CheckerJudgesComponent;
  let fixture: ComponentFixture<CheckerJudgesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckerJudgesComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SettingsService, useClass: SettingsServiceStub },
        { provide: WorkspaceService, useValue: {canOperate: () => true} },
        { provide: NotificationService, useValue: {showSuccess: jasmine.createSpy('showSuccess'), showError: jasmine.createSpy('showError')} },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CheckerJudgesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.judgeControls.length).toBeGreaterThan(0);
  });

  it('renders judges arriving after the initial page load without navigation', async () => {
    fixture.destroy();
    const settings = TestBed.inject(SettingsService) as unknown as SettingsServiceStub;
    const loadedSettings = {
      ...settings.getUserSettings()!,
      judges: [
        {url: 'https://example.com/first-judge', regex: 'default'},
        {url: 'https://example.com/second-judge', regex: 'custom'},
      ],
    };
    settings.setUserSettings(undefined);
    fixture = TestBed.createComponent(CheckerJudgesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector<HTMLInputElement>('#judge-url-0')!.value).toBe('');

    settings.setUserSettings(loadedSettings);
    await fixture.whenStable();

    expect(Array.from(host.querySelectorAll<HTMLInputElement>('input[type="url"]'), input => input.value))
      .toEqual(loadedSettings.judges.map(judge => judge.url));
    expect(host.querySelector<HTMLInputElement>('#judge-regex-1')?.value).toBe('custom');
    expect(host.querySelector('.card-count')!.textContent).toContain('2 judges');
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBeTrue();
  });

  it('saves edited judges without allowing the browser to reload the page', () => {
    const settings = TestBed.inject(SettingsService);
    const save = spyOn(settings, 'saveUserSettings').and.callThrough();
    const host: HTMLElement = fixture.nativeElement;
    const url = host.querySelector<HTMLInputElement>('#judge-url-0')!;
    url.value = 'https://example.com/new-judge';
    url.dispatchEvent(new Event('input', {bubbles: true}));
    fixture.detectChanges();

    let preventedByAngular = false;
    host.querySelector('form')!.addEventListener('submit', event => {
      preventedByAngular = event.defaultPrevented;
      // Keep the test runner on the page even if the regression returns.
      event.preventDefault();
    });
    const saveButton = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(saveButton.disabled).toBeFalse();
    saveButton.click();

    expect(preventedByAngular).toBeTrue();
    expect(save).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      judges: [{url: 'https://example.com/new-judge', regex: 'default'}],
    }));
    expect(TestBed.inject(NotificationService).showSuccess).toHaveBeenCalledWith('saved');
  });
});
