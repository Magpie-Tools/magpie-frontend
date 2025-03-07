import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminCheckerComponent } from './admin-checker.component';

describe('AdminCheckerComponent', () => {
  let component: AdminCheckerComponent;
  let fixture: ComponentFixture<AdminCheckerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCheckerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminCheckerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
