import {Component, Input} from '@angular/core';
import {Card} from 'primeng/card';
import {PrimeTemplate} from 'primeng/api';
import {UIChart} from 'primeng/chart';

@Component({
  selector: 'app-proxies-per-hour-card',
  standalone: true,
  imports: [Card, PrimeTemplate, UIChart],
  templateUrl: './proxies-per-hour-card.component.html',
  styleUrl: './proxies-per-hour-card.component.scss'
})
export class ProxiesPerHourCardComponent {
  @Input() title = 'Proxies per Hour (Last 7 Days)';
  @Input() chartData: any = {};
  @Input() chartOptions: any = {};
  @Input() styleClass = 'chart-card bg-neutral-900 border border-neutral-800 h-full';
  @Input() chartType: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'polarArea' = 'line';
}
