import {HlmCardImports} from '@spartan-ng/helm/card';
import {ChartComponent} from '../../../shared/ui/chart.component';
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
  @Input() chartData: any = {};
  @Input() chartOptions: any = {};
  @Input() styleClass = 'dashboard-card throughput-card';
  @Input() chartType: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'polarArea' = 'line';
}
