import {HlmCardImports} from '@spartan-ng/helm/card';
import {DashboardChartComponent} from '../../../shared/ui/dashboard-chart.component';
import type {DashboardChartDefinition} from '../../../shared/ui/dashboard-chart.component';
import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-proxies-per-hour-card',
  standalone: true,
  imports: [HlmCardImports, DashboardChartComponent],
  templateUrl: './proxies-per-hour-card.component.html',
  styleUrl: './proxies-per-hour-card.component.scss'
})
export class ProxiesPerHourCardComponent {
  @Input() title = 'Proxies per Hour (Last 7 Days)';
  @Input() chart: DashboardChartDefinition = {marks: [], scales: {x: null, y: null}};
  @Input() legend: Array<{label: string; color: string; dashed?: boolean}> = [];
  @Input() styleClass = 'dashboard-card throughput-card';
}
