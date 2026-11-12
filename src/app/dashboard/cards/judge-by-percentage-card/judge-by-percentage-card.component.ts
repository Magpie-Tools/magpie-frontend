import {HlmCardImports} from '@spartan-ng/helm/card';
import {Component, computed, Input} from '@angular/core';

import {DecimalPipe, NgStyle} from '@angular/common';
import {categoricalColors} from '../../chart-palette';

type TrafficMap = Record<string, number>;

@Component({
  selector: 'app-judge-by-percentage-card',
  imports: [HlmCardImports,

    NgStyle,
    DecimalPipe,
    ],
  templateUrl: './judge-by-percentage-card.component.html',
  styleUrl: './judge-by-percentage-card.component.scss'
})
export class JudgeByPercentageCardComponent {
  @Input({ required: true }) data!: TrafficMap;

  // Sorted entries with computed percentage
  entries = computed(() => {
    const items = Object.entries(this.data ?? {});
    const total = items.reduce((s, [, v]) => s + v, 0);
    const colors = categoricalColors(items.map(([k]) => k));
    const sorted = items.sort(([, a], [, b]) => b - a);
    return sorted.map(([k, v]) => {
      return {
        key: k,
        value: v,
        pct: total > 0 ? (v / total) * 100 : 0,
        color: colors.get(k)!,
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

}
