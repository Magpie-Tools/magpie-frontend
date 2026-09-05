import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MessageService} from 'primeng/api';
import {of, throwError} from 'rxjs';
import {ExportProxiesComponent} from './export-proxies.component';
import {SettingsService} from '../../../services/settings.service';
import {HttpService} from '../../../services/http.service';
import {NotificationService} from '../../../services/notification-service.service';

describe('ExportProxiesComponent', () => {
  let component: ExportProxiesComponent;
  let fixture: ComponentFixture<ExportProxiesComponent>;
  let exportProxiesSpy: jasmine.Spy;
  let showErrorSpy: jasmine.Spy;
  let createObjectUrlSpy: jasmine.Spy;
  let anchorClickSpy: jasmine.Spy;

  beforeEach(async () => {
    exportProxiesSpy = jasmine.createSpy('exportProxies');
    showErrorSpy = jasmine.createSpy('showError');
    createObjectUrlSpy = spyOn(window.URL, 'createObjectURL').and.returnValue('blob:export-proxies');
    spyOn(window.URL, 'revokeObjectURL');
    anchorClickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

    await TestBed.configureTestingModule({
      imports: [ExportProxiesComponent],
      providers: [
        {provide: SettingsService, useValue: {getUserSettings: () => ({})}},
        {provide: HttpService, useValue: {exportProxies: exportProxiesSpy}},
        {provide: NotificationService, useValue: {showError: showErrorSpy}},
        MessageService,
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ExportProxiesComponent);
    component = fixture.componentInstance;
    component.allProxies = [{id: 1} as never];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('downloads plain text export responses', () => {
    exportProxiesSpy.and.returnValue(of('http://127.0.0.1:8080'));

    component.submitExport();

    expect(exportProxiesSpy).toHaveBeenCalled();
    expect(createObjectUrlSpy).toHaveBeenCalledWith(jasmine.any(Blob));
    expect(anchorClickSpy).toHaveBeenCalled();
  });

  it('shows backend JSON error messages returned as text', () => {
    exportProxiesSpy.and.returnValue(
      throwError(() => ({
        error: '{"error":"Could not export proxies"}',
        message: 'Http failure response for /api/user/export: 500 Internal Server Error',
      }))
    );

    component.submitExport();

    expect(showErrorSpy).toHaveBeenCalledWith('Error while exporting proxies: Could not export proxies');
  });

  for (const failure of [
    {status: 0, error: 'http://192.0.2.1:80\n'},
    {status: 502, error: '<html><h1>502 Bad Gateway</h1></html>'},
  ]) {
    it(`does not save a file after an export failure with status ${failure.status}`, () => {
      exportProxiesSpy.and.returnValue(throwError(() => failure));

      component.submitExport();

      expect(createObjectUrlSpy).not.toHaveBeenCalled();
      expect(anchorClickSpy).not.toHaveBeenCalled();
      expect(component.isExporting).toBeFalse();
      expect(showErrorSpy).toHaveBeenCalled();
      expect(showErrorSpy.calls.mostRecent().args[0]).not.toContain('<html>');
    });
  }
});
