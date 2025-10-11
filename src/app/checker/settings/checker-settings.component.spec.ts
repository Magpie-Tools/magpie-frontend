import {ComponentFixture, TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {CheckerSettingsComponent} from './checker-settings.component';
import {SettingsService} from '../../services/settings.service';
import {UserSettings} from '../../models/UserSettings';

class SettingsServiceStub {
  private settings: UserSettings = {
    http_protocol: true,
    https_protocol: true,
    socks4_protocol: false,
    socks5_protocol: false,
    timeout: 7500,
    retries: 2,
    UseHttpsForSocks: true,
    judges: [{ url: 'https://example.com', regex: 'default' }],
    scraping_sources: []
  };

  getUserSettings(): UserSettings {
    return this.settings;
  }

  saveUserSettings() {
    return of({ message: 'saved' });
  }
}

describe('CheckerSettingsComponent', () => {
  let component: CheckerSettingsComponent;
  let fixture: ComponentFixture<CheckerSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckerSettingsComponent],
      providers: [{ provide: SettingsService, useClass: SettingsServiceStub }]
    }).compileComponents();

    fixture = TestBed.createComponent(CheckerSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.settingsForm.value.HTTPProtocol).toBeTrue();
  });
});
