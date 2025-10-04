import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProxiesPerCountryCardComponent } from './proxies-per-country-card.component';

describe('ProxiesPerCountryCardComponent', () => {
  let component: ProxiesPerCountryCardComponent;
  let fixture: ComponentFixture<ProxiesPerCountryCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProxiesPerCountryCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProxiesPerCountryCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
