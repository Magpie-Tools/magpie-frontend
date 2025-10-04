import {Component, computed, Input} from '@angular/core';
import {Card} from 'primeng/card';
import {DecimalPipe, NgForOf, NgStyle} from '@angular/common';

type TrafficMap = Record<string, number>;

@Component({
  selector: 'app-judge-by-percentage-card',
  imports: [
    Card,
    NgForOf,
    NgStyle,
    DecimalPipe
  ],
  templateUrl: './judge-by-percentage-card.component.html',
  styleUrl: './judge-by-percentage-card.component.scss'
})
export class JudgeByPercentageCardComponent {
  @Input({ required: true }) data!: TrafficMap;

  /** Optional: control the period dropdown. */
  @Input() periodOptions = ['Yearly', 'Quarterly', 'Monthly'];
  selectedPeriod = this.periodOptions[0];

  /** Color palette for bullets + segments; cycles if more keys than colors. */
  private colors = ['#F59E0B', '#9CA3AF', '#10B981', '#34D399', '#06B6D4', '#F59E0B'];

  // Sorted entries with computed percentage
  entries = computed(() => {
    const items = Object.entries(this.data ?? {});
    const total = items.reduce((s, [, v]) => s + v, 0);
    // keep original order; change to sort by value desc if needed
    return items.map(([k, v], i) => ({
      key: k,
      value: v,
      pct: total > 0 ? (v / total) * 100 : 0,
      color: this.colors[i % this.colors.length],
    }));
  });

  // For the segmented bar
  segments = computed(() =>
    this.entries().map((e) => ({
      widthPct: e.pct,
      color: e.color,
    })),
  );

  total = computed(() => Object.values(this.data ?? {}).reduce((s, v) => s + v, 0));
}
