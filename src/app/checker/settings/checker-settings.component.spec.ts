import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MessageService} from 'primeng/api';
import {of} from 'rxjs';
import {CheckerSettingsComponent} from './checker-settings.component';
import {SettingsService} from '../../services/settings.service';
import {UserSettings} from '../../models/UserSettings';
import {WorkspaceService} from '../../services/workspace.service';

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
    judges: [{ url: 'https://example.com', regex: 'default' }],
    scraping_sources: []
  };
  userSettings$ = of(this.settings);
  lastPayload: any;

  getUserSettings(): UserSettings {
    return this.settings;
  }

  saveUserSettings(payload: any) {
    this.lastPayload = payload;
    return of({ message: 'saved' });
  }
}

describe('CheckerSettingsComponent', () => {
  let component: CheckerSettingsComponent;
  let fixture: ComponentFixture<CheckerSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckerSettingsComponent],
      providers: [
        { provide: SettingsService, useClass: SettingsServiceStub },
        { provide: WorkspaceService, useValue: {canOperate: () => true} },
        MessageService,
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
  });

  it('starts with the settings grid instead of a hero', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.settings-hero')).toBeNull();
    expect(element.querySelector('.settings-stage > .settings-grid')).not.toBeNull();
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
});
