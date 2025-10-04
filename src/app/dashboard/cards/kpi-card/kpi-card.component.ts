import {Component, Input} from '@angular/core';
import {Card} from 'primeng/card';
import {Chip} from 'primeng/chip';
import {NgClass} from '@angular/common';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [Card, Chip, NgClass],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss'
})
export class KpiCardComponent {
  @Input() title = '';
  @Input() value: number | string = 0;
  @Input() change = 0;
  @Input() svgPath = 'M0,30 Q25,10 50,20 T100,15';
  @Input() styleClass = 'kpi-card bg-neutral-900 border border-neutral-800 rounded-2xl shadow-md';
  @Input() displayValue?: string | null;
  @Input() changeSuffix = '%';

  getChipClass(change: number): string {
    if (change > 2) {
      return '!bg-green-500/20 !text-green-400';
    }

    if (change < -2) {
      return '!bg-red-500/20 !text-red-400';
    }

    return '!bg-blue-500/20 !text-blue-400';
  }

  getChangeColorClass(change: number): string {
    if (change > 2) {
      return 'text-green-400';
    }

    if (change < -2) {
      return 'text-red-400';
    }

    return 'text-blue-400';
  }

  getChangeIcon(change: number): string {
    return change >= 0 ? 'pi-arrow-up' : 'pi-arrow-down';
  }
}
