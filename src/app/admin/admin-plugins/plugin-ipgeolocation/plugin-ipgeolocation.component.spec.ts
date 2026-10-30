import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {BehaviorSubject, of, throwError} from 'rxjs';
import {PluginIPGeolocationComponent} from './plugin-ipgeolocation.component';
import {SettingsService} from '../../../services/settings.service';
import {HttpService} from '../../../services/http.service';
import {NotificationService} from '../../../services/notification-service.service';
import {GlobalSettings} from '../../../models/GlobalSettings';

describe('PluginIPGeolocationComponent', () => {
  let fixture: ComponentFixture<PluginIPGeolocationComponent>;
  let component: PluginIPGeolocationComponent;
  let settings$: BehaviorSubject<GlobalSettings | undefined>;
  let save: jasmine.Spy;
  let status: jasmine.Spy;

  beforeEach(async () => {
    settings$ = new BehaviorSubject<GlobalSettings | undefined>({plugins: {}} as GlobalSettings);
    save = jasmine.createSpy('saveGlobalSettings').and.returnValue(of({message: 'Saved'}));
    status = jasmine.createSpy('getIPGeolocationStatus').and.returnValue(of({used_credits: 0, daily_credit_limit: 300, reset_at: '2026-10-30T00:00:00Z', last_error: ''}));
    await TestBed.configureTestingModule({
      imports: [PluginIPGeolocationComponent],
      providers: [provideRouter([]),
        {provide: SettingsService, useValue: {settings$, saveGlobalSettings: save}},
        {provide: HttpService, useValue: {getIPGeolocationStatus: status}},
        {provide: NotificationService, useValue: {showSuccess: jasmine.createSpy(), showError: jasmine.createSpy()}}
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(PluginIPGeolocationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('defaults to disabled and fetches local status once', () => {
    expect(component.form.controls.enabled.value).toBeFalse();
    expect(status).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Network classification requires a paid plan');
  });

  it('requires a key and sufficient whole-number credit limits', () => {
    component.form.patchValue({enabled: true, api_key: ''});
    expect(component.invalid()).toBeTrue();
    component.form.patchValue({api_key: 'key', include_security: true, daily_credit_limit: 2});
    component.onSubmit();
    expect(save).not.toHaveBeenCalled();
    component.form.patchValue({daily_credit_limit: 3.5});
    expect(component.invalid()).toBeTrue();
    component.form.patchValue({daily_credit_limit: 3});
    expect(component.invalid()).toBeFalse();
  });

  it('cannot save before the current global settings have loaded', () => {
    settings$.next(undefined);
    component.form.patchValue({api_key: 'key'}); component.form.markAsDirty(); component.onSubmit();
    expect(save).not.toHaveBeenCalled();
  });

  it('saves plugin policy with trimmed credentials', () => {
    component.form.patchValue({enabled: true, api_key: ' key ', include_security: true, cache_hours: 24, daily_credit_limit: 30});
    component.form.markAsDirty(); component.onSubmit();
    expect(save).toHaveBeenCalledWith({plugins: {ipgeolocation: {enabled: true, api_key: 'key', include_security: true, cache_hours: 24, daily_credit_limit: 30}}});
    expect(component.form.pristine).toBeTrue();
    expect(status).toHaveBeenCalledTimes(2);
  });

  it('preserves unsaved fields when another settings snapshot arrives', () => {
    component.form.patchValue({api_key: 'draft-key'}); component.form.markAsDirty();
    settings$.next({plugins: {ipgeolocation: {api_key: 'saved-key'}}} as GlobalSettings);
    component.refreshStatus();
    expect(component.form.controls.api_key.value).toBe('draft-key');
    expect(component.form.dirty).toBeTrue();
  });

  it('keeps dirty fields after a failed save and reports status failures', () => {
    save.and.returnValue(throwError(() => ({status: 500})));
    component.form.controls.api_key.setValue('key'); component.form.markAsDirty(); component.onSubmit();
    expect(component.form.dirty).toBeTrue(); expect(component.saving()).toBeFalse();
    status.and.returnValue(throwError(() => ({status: 503}))); component.refreshStatus();
    expect(component.statusError()).toContain('Status is unavailable');
  });
});
