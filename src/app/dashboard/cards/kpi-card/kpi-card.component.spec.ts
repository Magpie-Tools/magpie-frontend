import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LOCALE_ID, SimpleChange } from '@angular/core';

import { KpiCardComponent } from './kpi-card.component';

describe('KpiCardComponent', () => {
  let component: KpiCardComponent;
  let fixture: ComponentFixture<KpiCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KpiCardComponent],
      providers: [{ provide: LOCALE_ID, useValue: 'de-DE' }]
    })
      .compileComponents();

    fixture = TestBed.createComponent(KpiCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  for (const history of [[], [null, undefined, NaN, Infinity]]) {
    it(`hides trends without usable history ${JSON.stringify(history)}`, () => {
      fixture.componentRef.setInput('value', 200);
      fixture.componentRef.setInput('chartValues', history);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.metric-card__value').textContent.trim()).toBe('200');
      expect(fixture.nativeElement.querySelector('.metric-card__trend')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-chart')).toBeNull();
      expect(component.sparklinePoints).toEqual([]);
      expect(component.resolvedChange).toBeNull();
    });
  }

  it('shows only real samples as history becomes available and hides trends when it disappears', () => {
    fixture.componentRef.setInput('value', 200);
    fixture.componentRef.setInput('chartValues', [null, 180, undefined]);
    fixture.detectChanges();

    expect(component.sparklinePoints.map(point => point.value)).toEqual([180, 200]);
    expect(fixture.nativeElement.querySelector('app-chart')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.metric-card__trend').textContent).toContain('11,1');

    fixture.componentRef.setInput('chartValues', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.metric-card__trend')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-chart')).toBeNull();
  });

  it('hides an undefined percentage comparison from zero while keeping the real sparkline', () => {
    fixture.componentRef.setInput('value', 200);
    fixture.componentRef.setInput('chartValues', [0]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.metric-card__trend')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-chart')).not.toBeNull();
    expect(component.sparklinePoints.map(point => point.value)).toEqual([0, 200]);
  });

  it('keeps a genuine zero percent change visible', () => {
    fixture.componentRef.setInput('value', 200);
    fixture.componentRef.setInput('chartValues', [200]);
    fixture.detectChanges();

    expect(component.resolvedChange).toBe(0);
    expect(fixture.nativeElement.querySelector('.metric-card__trend').textContent).toContain('0,0');
    expect(fixture.nativeElement.querySelector('app-chart')).not.toBeNull();
  });

  for (const value of [NaN, Infinity, 'Unknown']) {
    it(`hides trends for an invalid current value ${value}`, () => {
      fixture.componentRef.setInput('value', value);
      fixture.componentRef.setInput('chartValues', [100, 150]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.metric-card__trend')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-chart')).toBeNull();
    });
  }

  it('should align chart data with current value', () => {
    component.value = 200;
    component.chartValues = [120, 140, 160, 180];

    component.ngOnChanges({
      value: new SimpleChange(null, component.value, true),
      chartValues: new SimpleChange(null, component.chartValues, true)
    });

    const dataset = component.sparklinePoints.map(point => point.value);
    expect(dataset.length).toBe(5);
    expect(dataset[dataset.length - 1]).toBe(200);
    expect(component.resolvedChange).toBe(11.1);
  });

  it('should allow explicit change override', () => {
    component.value = 150;
    component.chartValues = [100, 110, 120, 130];
    component.change = -2.5;

    component.ngOnChanges({
      change: new SimpleChange(null, component.change, true),
      value: new SimpleChange(null, component.value, true),
      chartValues: new SimpleChange(null, component.chartValues, true)
    });

    expect(component.resolvedChange).toBe(-2.5);
  });

  it('should calculate change from numeric value even when displayValue is localized', () => {
    component.value = 25000;
    component.displayValue = '25.000';
    component.chartValues = [20000, 22000, 24000];

    component.ngOnChanges({
      value: new SimpleChange(null, component.value, true),
      displayValue: new SimpleChange(null, component.displayValue, true),
      chartValues: new SimpleChange(null, component.chartValues, true)
    });

    expect(component.resolvedChange).toBe(4.2);
    const dataset = component.sparklinePoints.map(point => point.value);
    expect(dataset[dataset.length - 1]).toBe(25000);
  });

  it('should localize percent change label', () => {
    component.value = 25000;
    component.chartValues = [20000, 22000, 24000];
    component.ngOnChanges({
      value: new SimpleChange(null, component.value, true),
      chartValues: new SimpleChange(null, component.chartValues, true)
    });

    const formatted = component.formatChange(component.resolvedChange);
    expect(formatted).toContain('4,2');
    expect(formatted).toContain('%');
  });
});
