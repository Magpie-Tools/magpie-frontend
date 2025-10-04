import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JudgeByPercentageCardComponent } from './judge-by-percentage-card.component';

describe('JudgeByPercentageCardComponent', () => {
  let component: JudgeByPercentageCardComponent;
  let fixture: ComponentFixture<JudgeByPercentageCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JudgeByPercentageCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(JudgeByPercentageCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
