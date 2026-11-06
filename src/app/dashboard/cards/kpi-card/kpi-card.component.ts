import {HlmCardImports} from '@spartan-ng/helm/card';
import {HlmBadge} from '@spartan-ng/helm/badge';
import {ChartComponent} from '../../../shared/ui/chart.component';
import {buildMetricChart, MetricPoint} from '../../dashboard-charts';
import type {AppChartDefinition} from '../../../shared/ui/chart.component';
import {Component, Inject, Input, LOCALE_ID, OnChanges, SimpleChanges} from '@angular/core';

import {NgClass} from '@angular/common';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [HlmCardImports, HlmBadge, ChartComponent, NgClass],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss'
})
export class KpiCardComponent implements OnChanges {
  @Input() title = '';
  @Input() icon = 'icon icon-chart-no-axes-combined';
  @Input() value: number | string = 0;
  @Input() change?: number | null;
  @Input() styleClass = 'dashboard-card metric-card';
  @Input() displayValue?: string | null;
  @Input() changeSuffix = '%';
  @Input() chartValues: Array<number | null | undefined> = [];

  sparklinePoints: MetricPoint[] = [];
  sparklineChart: AppChartDefinition = {marks: [], scales: {x: null, y: null}};
  resolvedChange: number | null = null;
  private readonly numberFormatter: Intl.NumberFormat;
  private readonly percentFormatter: Intl.NumberFormat;

  constructor(@Inject(LOCALE_ID) localeId: string) {
    const normalizedLocale = localeId || 'en-US';
    this.numberFormatter = new Intl.NumberFormat(normalizedLocale);
    this.percentFormatter = new Intl.NumberFormat(normalizedLocale, {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.resolvedChange = this.resolveChange();
    this.sparklinePoints = this.buildSparklinePoints();
    this.sparklineChart = buildMetricChart(this.sparklinePoints, this.getTrendColor(this.resolvedChange ?? 0), value => this.formatNumber(value));
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
    return change > 0 ? 'icon-arrow-up' : change == 0 ? 'icon-move-vertical' : 'icon-arrow-down';
  }

  formatChange(change: number | null): string {
    if (change === null || !Number.isFinite(change)) {
      return '';
    }

    if (this.changeSuffix === '%') {
      return this.percentFormatter.format(change / 100);
    }

    return `${this.numberFormatter.format(change)}${this.changeSuffix}`;
  }

  private buildSparklinePoints(): MetricPoint[] {
    const currentValue = this.coerceNumericValue(this.value);
    const history = this.sanitiseHistory(this.chartValues);
    if (currentValue === null || !history.length) {
      return [];
    }

    const values = [...history.slice(-4), currentValue];
    return values.map((value, index) => ({index, value}));
  }

  private sanitiseHistory(values: Array<number | null | undefined>): number[] {
    return (values ?? [])
      .map(v => (typeof v === 'number' ? v : NaN))
      .filter(v => Number.isFinite(v));
  }

  private resolveChange(): number | null {
    if (typeof this.change === 'number' && Number.isFinite(this.change)) {
      return this.change;
    }

    const current = this.coerceNumericValue(this.value);
    const history = this.sanitiseHistory(this.chartValues);
    if (current === null || !history.length) {
      return null;
    }

    const previous = history[history.length - 1];
    if (!Number.isFinite(previous) || Math.abs(previous) < 1e-6) {
      return null;
    }

    const deltaPercent = ((current - previous) / Math.abs(previous)) * 100;
    if (!Number.isFinite(deltaPercent)) {
      return null;
    }

    return Math.round(deltaPercent * 10) / 10;
  }

  private coerceNumericValue(value: number | string | null | undefined): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
      const normalised = value.replace(/[^0-9+\-.,]/g, '').replace(/,(?=\d{3}(\D|$))/g, '');
      if (!normalised.trim()) {
        return null;
      }
      const parsed = Number(normalised.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private formatNumber(value: number | string | null | undefined): string {
    if (typeof value === 'number') {
      return this.numberFormatter.format(value);
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : this.numberFormatter.format(parsed);
    }

    return this.numberFormatter.format(0);
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

}
