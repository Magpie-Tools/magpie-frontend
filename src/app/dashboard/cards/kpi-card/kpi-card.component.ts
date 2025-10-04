import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {Card} from 'primeng/card';
import {Chip} from 'primeng/chip';
import {NgClass} from '@angular/common';
import {UIChart} from 'primeng/chart';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [Card, Chip, NgClass, UIChart],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss'
})
export class KpiCardComponent implements OnChanges {
  @Input() title = '';
  @Input() value: number | string = 0;
  @Input() change?: number | null;
  @Input() styleClass = 'kpi-card bg-neutral-900 border border-neutral-800 rounded-2xl shadow-md';
  @Input() displayValue?: string | null;
  @Input() changeSuffix = '%';
  @Input() chartValues: Array<number | null | undefined> = [];

  sparklineData: any = {};
  resolvedChange = 0;

  sparklineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.parsed.y}`,
          title: () => []
        },
        displayColors: false
      }
    },
    scales: {
      x: {
        display: false
      },
      y: {
        display: false
      }
    }
  };

  ngOnChanges(_changes: SimpleChanges): void {
    this.resolvedChange = this.resolveChange();
    this.sparklineData = this.buildSparklineData();
  }

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

  private buildSparklineData(): any {
    const currentValue = this.coerceNumericValue(this.displayValue ?? this.value);
    const history = [...this.sanitiseHistory(this.chartValues)];

    const trimmed = history.slice(-4);
    while (trimmed.length < 4) {
      trimmed.unshift(currentValue);
    }

    const values = [...trimmed, currentValue];
    const color = this.getTrendColor(this.resolvedChange);

    return {
      labels: values.map((_, index) => values[index]),
      datasets: [
        {
          data: values,
          borderColor: color,
          borderWidth: 2,
          tension: 0.35,
          fill: true,
          backgroundColor: this.withAlpha(color, 0.15),
          pointRadius: 0,
          pointHitRadius: 8
        }
      ]
    };
  }

  private sanitiseHistory(values: Array<number | null | undefined>): number[] {
    return (values ?? [])
      .map(v => (typeof v === 'number' ? v : NaN))
      .filter(v => !Number.isNaN(v));
  }

  private resolveChange(): number {
    if (typeof this.change === 'number' && Number.isFinite(this.change)) {
      return this.change;
    }

    const current = this.coerceNumericValue(this.displayValue ?? this.value);
    const history = this.sanitiseHistory(this.chartValues);
    if (!history.length) {
      return 0;
    }

    const previous = history[history.length - 1];
    if (!Number.isFinite(previous) || Math.abs(previous) < 1e-6) {
      return 0;
    }

    const deltaPercent = ((current - previous) / Math.abs(previous)) * 100;
    if (!Number.isFinite(deltaPercent)) {
      return 0;
    }

    return Math.round(deltaPercent * 10) / 10;
  }

  private coerceNumericValue(value: number | string | null | undefined): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const normalised = value.replace(/[^0-9+\-.,]/g, '').replace(/,(?=\d{3}(\D|$))/g, '');
      const parsed = Number(normalised.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private getTrendColor(change: number): string {
    if (change > 2) {
      return '#4ade80';
    }

    if (change < -2) {
      return '#f87171';
    }

    return '#60a5fa';
  }

  private withAlpha(hex: string, opacity: number): string {
    const normalized = hex.replace('#', '');
    const bigint = parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
}
