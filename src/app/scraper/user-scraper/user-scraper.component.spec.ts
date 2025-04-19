import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserScraperComponent } from './user-scraper.component';

describe('UserScraperComponent', () => {
  let component: UserScraperComponent;
  let fixture: ComponentFixture<UserScraperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserScraperComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserScraperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
