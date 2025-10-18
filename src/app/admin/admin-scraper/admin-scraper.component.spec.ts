import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminScraperComponent } from './admin-scraper.component';

describe('AdminScraperComponent', () => {
  let component: AdminScraperComponent;
  let fixture: ComponentFixture<AdminScraperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminScraperComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminScraperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
