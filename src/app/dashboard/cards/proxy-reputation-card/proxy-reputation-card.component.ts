import {HlmCardImports} from '@spartan-ng/helm/card';
import {DashboardChartComponent} from '../../../shared/ui/dashboard-chart.component';
import type {DashboardChartDefinition} from '../../../shared/ui/dashboard-chart.component';
import {REPUTATION_COLORS} from '../../dashboard-charts';
import {Component, Input} from '@angular/core';

import {DecimalPipe, NgStyle} from '@angular/common';

interface ReputationBreakdown {
  good: number;
  neutral: number;
  poor: number;
  unknown: number;
}

@Component({
  selector: 'app-proxy-reputation-card',
  standalone: true,
  imports: [HlmCardImports, DashboardChartComponent, NgStyle, DecimalPipe],
  templateUrl: './proxy-reputation-card.component.html',
  styleUrl: './proxy-reputation-card.component.scss'
})
export class ProxyReputationCardComponent {
  @Input({ required: true }) breakdown!: ReputationBreakdown;
  @Input({ required: true }) chart!: DashboardChartDefinition;

  readonly cardStyleClass = 'dashboard-card reputation-card';
  readonly labels: Array<{ key: keyof ReputationBreakdown; title: string }> = [
    { key: 'good', title: 'Good' },
    { key: 'neutral', title: 'Neutral' },
    { key: 'poor', title: 'Poor' },
    { key: 'unknown', title: 'Unknown' }
  ];

  get total(): number {
    if (!this.breakdown) {
      return 0;
    }
    return (
      (this.breakdown.good ?? 0) +
      (this.breakdown.neutral ?? 0) +
      (this.breakdown.poor ?? 0) +
      (this.breakdown.unknown ?? 0)
    );
  }

  get entries(): Array<{
    key: keyof ReputationBreakdown;
    title: string;
    value: number;
    percentage: number;
    color: string;
  }> {
    const total = this.total;
    return this.labels.map((entry, index) => {
      const raw = this.breakdown?.[entry.key] ?? 0;
      const color = REPUTATION_COLORS[index];
      return {
        key: entry.key,
        title: entry.title,
        value: raw,
        percentage: total > 0 ? Math.round((raw / total) * 1000) / 10 : 0,
        color
      };
    });
  }
}
