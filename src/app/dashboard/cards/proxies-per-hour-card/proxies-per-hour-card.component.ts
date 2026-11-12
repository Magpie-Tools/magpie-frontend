import {HlmCardImports} from '@spartan-ng/helm/card';
import {ChartComponent} from '../../../shared/ui/chart.component';
import type {AppChartDefinition} from '../../../shared/ui/chart.component';
import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-proxies-per-hour-card',
  standalone: true,
  imports: [HlmCardImports, ChartComponent],
  templateUrl: './proxies-per-hour-card.component.html',
  styleUrl: './proxies-per-hour-card.component.scss'
})
export class ProxiesPerHourCardComponent {
  @Input() title = 'Proxy inventory';
  /** Date span the chart covers, such as "Oct 8 – Nov 4". */
  @Input() range = '';
  /** Plain-language description of the chart for screen readers. */
  @Input() summary = '';
  @Input() chart: AppChartDefinition = {marks: [], scales: {x: null, y: null}};
  @Input() legend: Array<{label: string; color: string; dashed?: boolean}> = [];
  @Input() styleClass = 'dashboard-card throughput-card';
}
