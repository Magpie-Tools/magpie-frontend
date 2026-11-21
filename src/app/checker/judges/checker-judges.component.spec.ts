import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideZonelessChangeDetection} from '@angular/core';

import {BehaviorSubject, Observable, of} from 'rxjs';
import {CheckerJudgesComponent} from './checker-judges.component';
import {judgeRegexError, judgeUrlError} from './judge-validation';
import {UserSettings} from '../../models/UserSettings';
import {SettingsService} from '../../services/settings.service';
import {WorkspaceService} from '../../services/workspace.service';
import {NotificationService} from '../../services/notification-service.service';
import {GraphqlService, JudgeValidProxy} from '../../services/graphql.service';

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
    failure_action: 'pause',
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

class GraphqlServiceStub {
  rows: JudgeValidProxy[] | null = [];
  fetchJudgeValidProxies(): Observable<JudgeValidProxy[] | null> {
    return of(this.rows);
  }
}

describe('CheckerJudgesComponent', () => {
  let component: CheckerJudgesComponent;
  let fixture: ComponentFixture<CheckerJudgesComponent>;
  let host: HTMLElement;

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(CheckerJudgesComponent);
    component = fixture.componentInstance;
    host = fixture.nativeElement;
    await fixture.whenStable();
  }

  async function openRow(index: number): Promise<void> {
    host.querySelectorAll<HTMLButtonElement>('.judge-line')[index].click();
    await fixture.whenStable();
  }

  async function type(input: HTMLInputElement, value: string): Promise<void> {
    input.value = value;
    input.dispatchEvent(new Event('input', {bubbles: true}));
    await fixture.whenStable();
  }

  function settingsStub(): SettingsServiceStub {
    return TestBed.inject(SettingsService) as unknown as SettingsServiceStub;
  }

  function coverageText(): string[] {
    return Array.from(host.querySelectorAll('.coverage__cell'), cell => `${cell.querySelector('dt')!.textContent!.trim()} ${cell.querySelector('dd')!.textContent!.trim()}`);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckerJudgesComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SettingsService, useClass: SettingsServiceStub },
        { provide: GraphqlService, useClass: GraphqlServiceStub },
        { provide: WorkspaceService, useValue: {canOperate: () => true} },
        { provide: NotificationService, useValue: {showSuccess: jasmine.createSpy('showSuccess'), showError: jasmine.createSpy('showError')} },
      ]
    }).compileComponents();
  });

  it('should create', async () => {
    await render();
    expect(component).toBeTruthy();
    expect(component.judgeControls.length).toBe(1);
  });

  it('renders judges arriving after the initial page load without navigation', async () => {
    const settings = settingsStub();
    const loadedSettings = {
      ...settings.getUserSettings()!,
      judges: [
        {url: 'https://example.com/first-judge', regex: 'default'},
        {url: 'https://example.com/second-judge', regex: 'custom'},
      ],
    };
    settings.setUserSettings(undefined);
    await render();
    expect(host.querySelector('.judge-table__empty')!.textContent).toContain('Loading judges');

    settings.setUserSettings(loadedSettings);
    await fixture.whenStable();

    expect(Array.from(host.querySelectorAll('.judge-name small'), el => el.textContent!.trim()))
      .toEqual(['/first-judge', '/second-judge']);
    expect(Array.from(host.querySelectorAll('.judge-check'), el => el.textContent!.trim()))
      .toEqual(['Header check', 'Regex']);
    await openRow(1);
    expect(host.querySelector<HTMLInputElement>('#judge-regex-1')!.value).toBe('custom');
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBeTrue();
  });

  it('saves edited judges without allowing the browser to reload the page', async () => {
    await render();
    const save = spyOn(TestBed.inject(SettingsService), 'saveUserSettings').and.callThrough();
    await openRow(0);
    await type(host.querySelector<HTMLInputElement>('#judge-url-0')!, 'https://example.com/new-judge');

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
    expect(save).toHaveBeenCalledOnceWith({judges: [{url: 'https://example.com/new-judge', regex: 'default'}]});
    expect(TestBed.inject(NotificationService).showSuccess).toHaveBeenCalledWith('saved');
  });

  it('shows which protocols have no judge', async () => {
    await render();
    expect(coverageText()).toEqual(['HTTP Not checked', 'HTTPS 1 judge', 'SOCKS4 Not enabled', 'SOCKS5 Not enabled']);

    const settings = settingsStub();
    settings.setUserSettings({
      ...settings.getUserSettings()!,
      socks5_protocol: true,
      judges: [{url: 'http://azenv.net', regex: 'default'}, {url: 'https://example.com', regex: 'default'}],
    });
    await fixture.whenStable();
    expect(coverageText()).toEqual(['HTTP 1 judge', 'HTTPS 1 judge', 'SOCKS4 Not enabled', 'SOCKS5 Uses https:// judges']);
  });

  it('blocks saving a pattern the checker cannot compile', async () => {
    await render();
    component.judgeControls[0].patchValue({mode: 'regex'});
    await fixture.whenStable();
    await openRow(0);
    await type(host.querySelector<HTMLInputElement>('#judge-regex-0')!, '"ip"(?=\\d)');

    expect(host.querySelector('.field-error')!.textContent).toContain('does not support lookahead');
    expect(host.querySelector('.judge-check')!.textContent!.trim()).toBe('Pattern error');
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBeTrue();
  });

  it('shows alive proxies per judge and flags a judge that finds none', async () => {
    const graphql = TestBed.inject(GraphqlService) as unknown as GraphqlServiceStub;
    graphql.rows = [{judgeUrl: 'https://example.com', eliteProxies: 1200, anonymousProxies: 30, transparentProxies: 4}];
    const settings = settingsStub();
    settings.setUserSettings({
      ...settings.getUserSettings()!,
      judges: [{url: 'https://example.com', regex: 'default'}, {url: 'https://broken.example.com', regex: 'default'}],
    });
    await render();

    expect(Array.from(host.querySelectorAll('.judge-result'), el => el.textContent!.trim()))
      .toEqual(['1,234', '0, check the URL']);
  });

  it('discards unsaved changes', async () => {
    await render();
    component.addJudge();
    await fixture.whenStable();
    expect(component.judgeControls.length).toBe(2);

    host.querySelector<HTMLButtonElement>('[settings-save-action]')!.click();
    await fixture.whenStable();
    expect(component.judgeControls.length).toBe(1);
    expect(component.judgesForm.dirty).toBeFalse();
  });
});

describe('judge validation', () => {
  it('accepts RE2 syntax that JavaScript lacks', () => {
    expect(judgeRegexError('(?i)origin')).toBeNull();
    expect(judgeRegexError('(?P<ip>\\d+\\.\\d+)')).toBeNull();
  });

  it('rejects patterns the checker cannot run', () => {
    expect(judgeRegexError('(?<=ip)\\d')).toContain('lookahead, lookbehind');
    expect(judgeRegexError('("ip"')).toContain('does not compile');
    expect(judgeRegexError(' ')).toBe('Enter a pattern.');
  });

  it('requires an http or https URL', () => {
    expect(judgeUrlError('azenv.net/judge')).toBe('Start the URL with http:// or https://.');
    expect(judgeUrlError('http://azenv.net')).toBeNull();
  });
});
