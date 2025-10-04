import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProxiesByAnonymityCardComponent } from './proxies-by-anonymity-card.component';

describe('ProxiesByAnonymityCardComponent', () => {
  let component: ProxiesByAnonymityCardComponent;
  let fixture: ComponentFixture<ProxiesByAnonymityCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProxiesByAnonymityCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProxiesByAnonymityCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
