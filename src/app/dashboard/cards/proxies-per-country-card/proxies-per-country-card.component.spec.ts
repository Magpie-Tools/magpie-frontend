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

  it('should resolve the Saint Lucia flag from common labels', () => {
    expect(component.countryFlag({name: 'Saint Lucia', percentage: 10})).toBe('🇱🇨');
    expect(component.countryFlag({name: 'St. Lucia', percentage: 10})).toBe('🇱🇨');
  });

  it('should resolve the DRC flag from the parenthesized Congo label', () => {
    expect(component.countryFlag({name: 'Congo (DRC)', percentage: 10})).toBe('🇨🇩');
  });

  it('joins aliases to the same map feature and retains unknown countries in the list', () => {
    fixture.componentRef.setInput('countries', [
      {name: 'USA', percentage: 25, value: 10},
      {name: 'United States', percentage: 50, value: 20},
      {name: 'Unknown', percentage: 25, value: 10},
    ]);
    fixture.detectChanges();
    expect(component.mapFeatures.find(feature => feature.properties.name === 'United States of America')?.properties.value).toBe(30);
    expect(component.maxCountryValue).toBe(30);
    expect(component.totalValue).toBe(40);
    expect(component.mapFeatures.some(feature => feature.properties.name === 'Antarctica')).toBeFalse();
    fixture.nativeElement.querySelector('.country-tabs button:nth-child(2)').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.country-list').textContent).toContain('Unknown');
    fixture.nativeElement.querySelector('.country-tabs button:nth-child(1)').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('tanstack-chart')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('canvas')).toBeNull();
  });
});
