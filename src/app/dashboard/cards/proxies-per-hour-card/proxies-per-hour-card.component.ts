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
  @Input() title = 'Proxies per Hour (Last 7 Days)';
  @Input() chart: AppChartDefinition = {marks: [], scales: {x: null, y: null}};
  @Input() legend: Array<{label: string; color: string; dashed?: boolean}> = [];
  @Input() styleClass = 'dashboard-card throughput-card';
}
