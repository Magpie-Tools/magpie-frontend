import {Component, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {DashboardChartComponent} from './dashboard-chart.component';
import {buildMetricChart} from '../../dashboard/dashboard-charts';

@Component({
  imports: [DashboardChartComponent],
  template: `<div [style.width.px]="width()" style="height:52px;transform:scale(0.965)">
    <app-dashboard-chart [definition]="chart" label="Metric trend" />
  </div>`,
})
class ScaledChartHost {
  readonly width = signal(600);
  readonly chart = buildMetricChart([{index: 0, value: 100}, {index: 1, value: 120}], '#60a5fa', String);
}

describe('DashboardChartComponent sizing', () => {
  let fixture: ComponentFixture<ScaledChartHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [ScaledChartHost]}).compileComponents();
    fixture = TestBed.createComponent(ScaledChartHost);
  });

  async function render() {
    fixture.detectChanges();
    // Allow the browser's ResizeObserver and the chart's rendering frame to run.
    for (let frame = 0; frame < 4; frame++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    await fixture.whenStable();
  }

  function expectLayoutWidth(width: number) {
    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    expect(svg.viewBox.baseVal.width).toBeCloseTo(width, 1);
    const path = fixture.nativeElement.querySelector('.ts-chart__line path') as SVGPathElement;
    const bounds = path.getBBox();
    expect(bounds.x).toBeCloseTo(0, 1);
    expect(bounds.width).toBeCloseTo(width, 1);
  }

  it('uses the full layout width on initial render inside a scaled card', async () => {
    await render();
    expectLayoutWidth(600);
  });

  it('tracks layout changes while a card remains scaled', async () => {
    await render();
    fixture.componentInstance.width.set(900);
    await render();
    expectLayoutWidth(900);
  });
});
