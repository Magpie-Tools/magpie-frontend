import {Component, computed, Input} from '@angular/core';
import {Card} from 'primeng/card';
import {DecimalPipe, NgClass, NgForOf, NgStyle} from '@angular/common';
import {PrimeTemplate} from 'primeng/api';

type TrafficMap = Record<string, number>;

@Component({
  selector: 'app-judge-by-percentage-card',
  imports: [
    Card,
    NgForOf,
    NgStyle,
    DecimalPipe,
    NgClass,
    PrimeTemplate
  ],
  templateUrl: './judge-by-percentage-card.component.html',
  styleUrl: './judge-by-percentage-card.component.scss'
})
export class JudgeByPercentageCardComponent {
  @Input({ required: true }) data!: TrafficMap;

  /** Optional: control the period dropdown. */
  @Input() periodOptions = ['Yearly', 'Quarterly', 'Monthly'];
  selectedPeriod = this.periodOptions[0];

  /** Cache avoids recomputing colors for keys we already processed. */
  private colorCache = new Map<string, string>();

  // Sorted entries with computed percentage
  entries = computed(() => {
    const items = Object.entries(this.data ?? {});
    const total = items.reduce((s, [, v]) => s + v, 0);
    const sorted = items.sort(([, a], [, b]) => b - a);
    return sorted.map(([k, v]) => {
      return {
        key: k,
        value: v,
        pct: total > 0 ? (v / total) * 100 : 0,
        color: this.colorForKey(k),
      };
    });
  });

  // For the segmented bar
  segments = computed(() =>
    this.entries().map((e) => ({
      widthPct: e.pct,
      color: e.color,
    })),
  );

  total = computed(() => Object.values(this.data ?? {}).reduce((s, v) => s + v, 0));

  /**
   * Generate a saturated but balanced color derived from the provided key.
   * The hash ensures identical strings always map to the same hue.
   */
  private colorForKey(key: string): string {
    const cached = this.colorCache.get(key);
    if (cached) {
      return cached;
    }

    const hash = this.hashString(key);
    const hue = hash % 360;
    const saturation = 65;
    const lightness = 52;
    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

    this.colorCache.set(key, color);
    return color;
  }

  private hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }

    return Math.abs(hash);
  }
}
