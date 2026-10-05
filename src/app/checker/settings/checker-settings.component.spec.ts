import {ComponentFixture, TestBed} from '@angular/core/testing';

import {of, Subject} from 'rxjs';
import {provideZonelessChangeDetection, signal} from '@angular/core';
import {ProxyTagService} from '../../services/proxy-tag.service';
import {NotificationService} from '../../services/notification-service.service';
import {CheckerSettingsComponent} from './checker-settings.component';
import {SettingsService} from '../../services/settings.service';
import {UserSettings} from '../../models/UserSettings';
import {WorkspaceService} from '../../services/workspace.service';
import {HttpService} from '../../services/http.service';
import {UserService} from '../../services/authorization/user.service';
import {HlmToaster} from '@spartan-ng/helm/sonner';
import {toast} from '@spartan-ng/brain/sonner';

class SettingsServiceStub {
  private settings: UserSettings = {
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
  userSettings$ = of(this.settings);
  lastPayload: any;
  response?: Subject<any>;

  getUserSettings(): UserSettings | undefined {
    return this.settings;
  }

  saveUserSettings(payload: any) {
    this.lastPayload = payload;
    return this.response ?? of({ message: 'saved' });
  }
}

describe('CheckerSettingsComponent', () => {
  let component: CheckerSettingsComponent;
  let fixture: ComponentFixture<CheckerSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckerSettingsComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SettingsService, useClass: SettingsServiceStub },
        { provide: WorkspaceService, useValue: {canOperate: () => true} },
        { provide: ProxyTagService, useValue: {loading: signal(false), tags: signal([{id: 1, name: 'One', color: '#22C55E'}, {id: 2, name: 'Two', color: '#22C55E'}]), load: () => of([])} },
        { provide: NotificationService, useValue: {showError: jasmine.createSpy(), showSuccess: jasmine.createSpy()} },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CheckerSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.settingsForm.value.HTTPProtocol).toBeTrue();
    expect(component.settingsForm.value.AutoRemoveFailingProxies).toBeFalse();
    expect(component.settingsForm.getRawValue().AutoRemoveFailureThreshold).toBe(3);
    expect(component.settingsForm.getRawValue().FailureAction).toBe('pause');
    expect(component.settingsForm.get('FailureAction')?.disabled).toBeTrue();
  });

  it('renders safely and blocks saving until asynchronous settings arrive', () => {
    fixture.destroy();
    const service = TestBed.inject(SettingsService) as unknown as SettingsServiceStub;
    const stored = service.getUserSettings()!;
    const updates = new Subject<UserSettings>();
    service.userSettings$ = updates;
    const getSettings = spyOn(service, 'getUserSettings').and.returnValue(undefined);
    fixture = TestBed.createComponent(CheckerSettingsComponent);
    component = fixture.componentInstance;

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(component.settingsForm).toBeTruthy();
    expect(component.settingsLoaded).toBeFalse();
    expect((fixture.nativeElement.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBeTrue();
    component.onSubmit();
    expect(service.lastPayload).toBeUndefined();

    getSettings.and.returnValue(stored);
    updates.next(stored);
    fixture.detectChanges();
    expect(component.settingsLoaded).toBeTrue();
    expect(component.settingsForm.get('HTTPProtocol')?.value).toBeTrue();
    expect((fixture.nativeElement.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBeFalse();
  });

  it('keeps the original grouped cards instead of individual protocol forms', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.settings-hero')).toBeNull();
    expect(element.querySelector('.settings-stage > .settings-grid')).not.toBeNull();
    expect(element.querySelector('.settings-card--protocols')).not.toBeNull();
    expect(element.querySelectorAll('input[formControlName=Timeout]').length).toBe(1);
    expect(element.querySelectorAll('input[formControlName=Retries]').length).toBe(1);
    expect(element.querySelectorAll('app-select[formControlName=TransportProtocol]').length).toBe(1);
    expect(element.querySelector('.rule-priority')).toBeNull();
  });

  it('normalizes auto-remove threshold before saving', () => {
    const service = TestBed.inject(SettingsService) as unknown as SettingsServiceStub;
    component.settingsForm.patchValue({
      AutoRemoveFailingProxies: true,
      AutoRemoveFailureThreshold: 0,
    });

    component.onSubmit();

    expect(service.lastPayload.AutoRemoveFailureThreshold).toBe(1);
  });

  it('enables and saves Delete when automatic handling is enabled', () => {
    const service = TestBed.inject(SettingsService) as unknown as SettingsServiceStub;
    component.settingsForm.patchValue({AutoRemoveFailingProxies: true, FailureAction: 'delete'});
    fixture.detectChanges();

    expect(component.settingsForm.get('FailureAction')?.enabled).toBeTrue();

    component.onSubmit();

    expect(service.lastPayload.FailureAction).toBe('delete');
    expect(service.lastPayload.AutoRemoveFailingProxies).toBeTrue();
  });

  it('retains the selected action while automatic handling is disabled', () => {
    const service = TestBed.inject(SettingsService) as unknown as SettingsServiceStub;
    component.settingsForm.patchValue({AutoRemoveFailingProxies: true, FailureAction: 'delete'});
    component.settingsForm.get('AutoRemoveFailingProxies')?.setValue(false);

    expect(component.settingsForm.get('FailureAction')?.disabled).toBeTrue();
    expect(component.settingsForm.get('AutoRemoveFailureThreshold')?.disabled).toBeTrue();

    component.onSubmit();

    expect(service.lastPayload.FailureAction).toBe('delete');
    expect(service.lastPayload.AutoRemoveFailingProxies).toBeFalse();
  });

  it('prevents a viewer from changing the failure action or saving settings', () => {
    const service = TestBed.inject(SettingsService) as unknown as SettingsServiceStub;
    const workspaces = TestBed.inject(WorkspaceService);
    spyOn(workspaces, 'canOperate').and.returnValue(false);
    component.settingsForm.get('AutoRemoveFailingProxies')?.setValue(true);

    expect(component.settingsForm.get('FailureAction')?.disabled).toBeTrue();

    component.onSubmit();

    expect(service.lastPayload).toBeUndefined();
  });

  it('toggles protocol choices through the card controls', () => {
    expect(component.selectedProtocolCount).toBe(2);

    component.toggleProtocol('SOCKS4Protocol');

    expect(component.settingsForm.value.SOCKS4Protocol).toBeTrue();
    expect(component.selectedProtocolCount).toBe(3);
    expect(component.settingsForm.dirty).toBeTrue();
  });

  it('summarizes the configured retry window', () => {
    component.settingsForm.patchValue({Retries: 2, Timeout: 7500});

    expect(component.totalAttempts).toBe(3);
    expect(component.configuredAttemptWindow).toBe('23 sec');
  });
  it('retains drafts when switching profiles and saves all profiles in priority order', () => {
    component.settingsForm.patchValue({SOCKS5Protocol: true, Timeout: 4000});
    component.selectedProfile.setValue(1);
    component.addRule();
    component.profileForm.patchValue({HTTPProtocol: true, Timeout: 2000, Retries: 0});
    component.selectedProfile.setValue(2);
    component.addRule();
    component.selectedRule?.get('Mode')?.setValue('remove');
    component.profileForm.get('SOCKS5Protocol')?.setValue(true);
    component.onPriorityStateChanged('open');
    component.movePriority(1, -1);
    component.applyPriority();
    component.selectedProfile.setValue(1);
    expect(component.profileForm.get('Timeout')?.value).toBe(2000);
    component.selectedProfile.setValue(0);
    expect(component.settingsForm.get('Timeout')?.value).toBe(4000);
    component.onSubmit();
    const service = TestBed.inject(SettingsService) as unknown as SettingsServiceStub;
    expect(service.lastPayload.checker_settings.rules).toEqual([
      {tag_id: 2, mode: 'remove', protocols: ['socks5']},
      {tag_id: 1, mode: 'add', protocols: ['http'], timeout: 2000, retries: 0},
    ]);
    expect(service.lastPayload.SOCKS5Protocol).toBeTrue();
  });

  it('inherits fields independently and preserves an explicit zero retries', () => {
    component.selectedProfile.setValue(1);
    component.addRule();
    component.profileForm.patchValue({HTTPProtocol: true, Timeout: 1200, Retries: 0});
    component.setInherited('Timeout', true);
    expect(component.serializeProfiles().rules[0]).toEqual({tag_id: 1, mode: 'add', protocols: ['http'], retries: 0});
    component.setInherited('Retries', true);
    expect(component.serializeProfiles().rules[0]).toEqual({tag_id: 1, mode: 'add', protocols: ['http']});
  });

  it('unlocks the page and keeps drafts and their priority after a failed save', async () => {
    const service = TestBed.inject(SettingsService) as unknown as SettingsServiceStub;
    service.response = new Subject();
    component.selectedProfile.setValue(1);
    component.addRule();
    component.profileForm.patchValue({HTTPProtocol: true, Timeout: 1000});
    const draft = component.serializeProfiles();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.save-settings-button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(component.saving()).toBeTrue();
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBeTrue();
    service.response.error({error: {error: 'Save failed'}});
    await fixture.whenStable();
    expect(component.saving()).toBeFalse();
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBeFalse();
    expect(component.settingsForm.dirty).toBeTrue();
    expect(component.serializeProfiles()).toEqual(draft);
    const protocolButton = fixture.nativeElement.querySelectorAll('.protocol-choice')[1] as HTMLButtonElement;
    protocolButton.click();
    await fixture.whenStable();
    expect(component.selectedProtocolCount).toBe(2);
    expect(protocolButton.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('.save-settings-button').disabled).toBeFalse();
  });

  it('unlocks the page and retains edits if the save completes without a response', async () => {
    const service = TestBed.inject(SettingsService) as unknown as SettingsServiceStub;
    service.response = new Subject();
    (fixture.nativeElement.querySelector('.protocol-choice') as HTMLButtonElement).click();
    await fixture.whenStable();
    const draft = component.serializeProfiles();
    (fixture.nativeElement.querySelector('.save-settings-button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBeTrue();

    service.response.complete();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBeFalse();
    expect(component.settingsForm.dirty).toBeTrue();
    expect(component.serializeProfiles()).toEqual(draft);
    expect(fixture.nativeElement.querySelector('.save-settings-button').disabled).toBeFalse();
  });

  it('removes a deleted tag rule without dropping edits to other profiles', () => {
    component.settingsForm.patchValue({Timeout: 1234});
    component.selectedProfile.setValue(1);
    component.addRule();
    const tags = TestBed.inject(ProxyTagService);
    (tags.tags as any).set([{id: 2, name: 'Two', color: '#22C55E'}]);
    component.onTagsChanged();
    expect(component.rules.length).toBe(0);
    expect(component.selectedProfile.value).toBe(0);
    expect(component.settingsForm.get('Timeout')?.value).toBe(1234);
  });

  it('keeps canceled priority changes out of the saved order', () => {
    component.selectedProfile.setValue(1); component.addRule();
    component.selectedProfile.setValue(2); component.addRule();
    const before = component.serializeProfiles();
    component.onPriorityStateChanged('open');
    component.movePriority(0, 1);
    component.onPriorityStateChanged('closed');
    expect(component.serializeProfiles()).toEqual(before);
    component.onPriorityStateChanged('open');
    expect(component.priorityDraft()).toEqual([1, 2]);
  });
  it('applies drag order while preserving profile drafts', () => {
    component.selectedProfile.setValue(1); component.addRule();
    component.profileForm.patchValue({Timeout: 1400, Retries: 0});
    component.selectedProfile.setValue(2); component.addRule();
    component.onPriorityStateChanged('open');
    component.dropPriority({previousIndex: 0, currentIndex: 1, isPointerOverContainer: true} as any);
    expect(component.serializeProfiles().rules.map(rule => rule.tag_id)).toEqual([1, 2]);
    component.applyPriority();
    expect(component.serializeProfiles().rules.map(rule => rule.tag_id)).toEqual([2, 1]);
    component.selectedProfile.setValue(1);
    expect(component.profileForm.get('Timeout')?.value).toBe(1400);
    expect(component.profileForm.get('Retries')?.value).toBe(0);
    expect(component.settingsForm.dirty).toBeTrue();
  });
  it('allows tags to override shared settings without changing protocol selection', () => {
    component.selectedProfile.setValue(1); component.addRule();
    component.profileForm.patchValue({Mode: 'add', Timeout: 1600, TransportProtocol: 'tcp'});
    expect(component.serializeProfiles().rules[0]).toEqual({tag_id: 1, mode: 'add', protocols: [], transport: 'tcp', timeout: 1600});
  });
  it('enables loaded settings when workspace permissions arrive later', () => {
    fixture.destroy();
    const permission = signal(false);
    const workspaces = TestBed.inject(WorkspaceService);
    spyOn(workspaces, 'canOperate').and.callFake(permission);
    fixture = TestBed.createComponent(CheckerSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.settingsForm.get('Timeout')?.disabled).toBeTrue();
    permission.set(true);
    fixture.detectChanges();
    expect(component.settingsForm.get('Timeout')?.enabled).toBeTrue();
    expect(component.settingsForm.get('Retries')?.enabled).toBeTrue();
    expect(component.settingsForm.get('TransportProtocol')?.enabled).toBeTrue();
    expect(component.settingsForm.get('FailureAction')?.disabled).toBeTrue();
    permission.set(false);
    fixture.detectChanges();
    expect(component.settingsForm.disabled).toBeTrue();
  });

});

describe('CheckerSettingsComponent with SettingsService', () => {
  afterEach(() => toast.dismiss());

  for (const {profile, empty} of [
    {profile: 'Default', empty: true},
    {profile: 'tag', empty: true},
    {profile: 'Default', empty: false},
    {profile: 'tag', empty: false},
  ]) {
    it(`can edit and save ${profile} repeatedly after saving ${empty ? 'no protocols' : 'enabled protocols'}`, async () => {
      spyOn(UserService, 'isLoggedIn').and.returnValue(true);
      spyOn(UserService, 'isAdmin').and.returnValue(false);
      const response = new Subject<{message: string}>();
      const http = jasmine.createSpyObj<HttpService>('HttpService', ['getUserSettings', 'saveUserSettings']);
      http.getUserSettings.and.returnValue(of(new SettingsServiceStub().getUserSettings()!));
      http.saveUserSettings.and.returnValue(response);
      await TestBed.configureTestingModule({
        imports: [CheckerSettingsComponent, HlmToaster],
        providers: [
          provideZonelessChangeDetection(),
          SettingsService,
          {provide: HttpService, useValue: http},
          {provide: UserService, useValue: {role$: of('user')}},
          {provide: WorkspaceService, useValue: {canOperate: () => true}},
          {provide: ProxyTagService, useValue: {loading: signal(false), tags: signal([{id: 1, name: 'One', color: '#22C55E'}]), load: () => of([])}},
          NotificationService,
        ],
      }).compileComponents();
      const notification = TestBed.inject(NotificationService);
      spyOn(notification, 'showSuccess').and.callThrough();
      const toasterFixture = TestBed.createComponent(HlmToaster);
      const fixture = TestBed.createComponent(CheckerSettingsComponent);
      const component = fixture.componentInstance;
      await fixture.whenStable();
      if (profile === 'tag') {
        component.selectedProfile.setValue(1);
        component.addRule();
        fixture.detectChanges();
        if (!empty) {
          (fixture.nativeElement.querySelectorAll('.protocol-choice')[1] as HTMLButtonElement).click();
          await fixture.whenStable();
        }
      } else {
        for (const button of fixture.nativeElement.querySelectorAll('.protocol-choice.is-active')) {
          if (empty || (button as HTMLButtonElement).querySelector('strong')?.textContent?.trim() === 'HTTP') {
            (button as HTMLButtonElement).click();
          }
        }
        await fixture.whenStable();
      }
      expect(component.selectedProtocolCount).toBe(empty ? 0 : 1);
      const saveButton = fixture.nativeElement.querySelector('.save-settings-button') as HTMLButtonElement;
      const fieldset = fixture.nativeElement.querySelector('fieldset') as HTMLFieldSetElement;
      saveButton.click();
      await fixture.whenStable();
      expect(fieldset.disabled).toBeTrue();

      response.next({message: 'saved'});
      response.complete();
      await fixture.whenStable();

      expect(TestBed.inject(NotificationService).showSuccess).toHaveBeenCalledWith('saved');
      expect(toasterFixture.nativeElement.textContent).toContain('saved');
      expect(component.selectedProtocolCount).toBe(empty ? 0 : 1);
      expect(fieldset.disabled).toBeFalse();
      const protocolButton = fixture.nativeElement.querySelector('.protocol-choice') as HTMLButtonElement;
      expect(protocolButton.matches(':disabled')).toBeFalse();
      protocolButton.click();
      await fixture.whenStable();
      expect(component.selectedProtocolCount).toBe(empty ? 1 : 2);
      expect(protocolButton.getAttribute('aria-pressed')).toBe('true');
      expect(component.settingsForm.dirty).toBeTrue();
      expect(saveButton.disabled).toBeFalse();

      http.saveUserSettings.and.returnValue(of({message: 'saved again'}));
      saveButton.click();
      await fixture.whenStable();
      expect(http.saveUserSettings).toHaveBeenCalledTimes(2);
      const saved = TestBed.inject(SettingsService).getUserSettings()!.checker_settings!;
      expect(profile === 'Default' ? saved.defaults.protocols : saved.rules[0].protocols).toEqual(empty ? ['http'] : ['http', 'https']);
      expect(component.settingsForm.pristine).toBeTrue();
      expect(fieldset.disabled).toBeFalse();
    });
  }
});
