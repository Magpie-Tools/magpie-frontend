import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminBlacklistComponent } from './admin-blacklist.component';

describe('AdminBlacklistComponent', () => {
  let component: AdminBlacklistComponent;
  let fixture: ComponentFixture<AdminBlacklistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminBlacklistComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminBlacklistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
