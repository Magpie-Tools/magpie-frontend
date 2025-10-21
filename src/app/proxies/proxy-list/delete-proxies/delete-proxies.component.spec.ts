import {ComponentFixture, TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {DeleteProxiesComponent} from './delete-proxies.component';
import {SettingsService} from '../../../services/settings.service';
import {HttpService} from '../../../services/http.service';

describe('DeleteProxiesComponent', () => {
  let component: DeleteProxiesComponent;
  let fixture: ComponentFixture<DeleteProxiesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteProxiesComponent],
      providers: [
        {provide: SettingsService, useValue: {getUserSettings: () => ({})}},
        {provide: HttpService, useValue: {deleteProxies: () => of('')}}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteProxiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

