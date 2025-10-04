import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';

import { KpiCardComponent } from './kpi-card.component';

describe('KpiCardComponent', () => {
  let component: KpiCardComponent;
  let fixture: ComponentFixture<KpiCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KpiCardComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(KpiCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should align chart data with current value', () => {
    component.value = 200;
    component.chartValues = [120, 140, 160, 180];

    component.ngOnChanges({
      value: new SimpleChange(null, component.value, true),
      chartValues: new SimpleChange(null, component.chartValues, true)
    });

    const dataset = component.sparklineData.datasets[0].data as number[];
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

  it('should configure tooltip to show only value', () => {
    const tooltipConfig = component.sparklineOptions.plugins.tooltip;
    const label = tooltipConfig.callbacks.label({ parsed: { y: 42 } } as any);
    const title = tooltipConfig.callbacks.title();

    expect(label).toBe('42');
    expect(title).toEqual([]);
  });
});
