import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProxiesPerHourCardComponent } from './proxies-per-hour-card.component';

describe('ProxiesPerHourCardComponent', () => {
  let component: ProxiesPerHourCardComponent;
  let fixture: ComponentFixture<ProxiesPerHourCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProxiesPerHourCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProxiesPerHourCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
