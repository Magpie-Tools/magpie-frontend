import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { Chart, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

/** Owns Chart.js canvases, including the registered geographic chart controllers. */
@Component({
  selector: 'app-chart',
  template:
    '<canvas #canvas role="img" [attr.aria-label]="label">{{ label }}</canvas>',
  styles: [
    ':host { display: block; position: relative; min-width: 0; width: 100%; height: 100%; }',
  ],
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas') canvas?: ElementRef<HTMLCanvasElement>;
  @Input() type: string = 'bar';
  @Input() data: any;
  @Input() options: any;
  @Input() label = 'Proxy statistics chart';
  chart?: Chart;
  ngAfterViewInit(): void {
    this.render();
  }
  ngOnChanges(): void {
    this.render();
  }
  private render(): void {
    if (!this.canvas) return;
    this.chart?.destroy();
    this.chart = new Chart(this.canvas.nativeElement, {
      type: this.type as ChartType,
      data: this.data ?? { datasets: [] },
      options: this.options ?? {},
    });
  }
  refresh(): void {
    this.chart?.update();
  }
  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
