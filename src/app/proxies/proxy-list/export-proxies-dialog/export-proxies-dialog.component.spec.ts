import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExportProxiesDialogComponent } from './export-proxies-dialog.component';

describe('ExportProxiesDialogComponent', () => {
  let component: ExportProxiesDialogComponent;
  let fixture: ComponentFixture<ExportProxiesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportProxiesDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExportProxiesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
