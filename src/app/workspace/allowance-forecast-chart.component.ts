import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  LOCALE_ID,
  signal,
} from '@angular/core';

/** One point of a forecast line: a time and the share of the allowance used by then. */
export interface ForecastPoint {
  time: number;
  percent: number;
}

/** A metric drawn on the allowance chart, as a share of its own monthly allowance. */
export interface ForecastSeries {
  id: string;
  label: string;
  /** CSS colour of the line; text never uses it. */
  color: string;
  /** Usage from the period start to now. */
  used: ForecastPoint[];
  /** The projection from now to the period end at the current cadence. */
  projected: ForecastPoint[];
  /** When the allowance runs out before the period ends. */
  runOutAt: number | null;
}

const HEIGHT = 240;
const PAD = {left: 46, top: 16, bottom: 26};
const Y_MAX = 110;
const TICKS = [0, 25, 50, 75, 100];

/**
 * Draws metered allowance use and its projection on one percentage scale, so
 * metrics with different allowances can share an axis.
 */
@Component({
  selector: 'app-allowance-forecast-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="forecast-svg"
      [attr.viewBox]="'0 0 ' + width() + ' ' + height"
      [attr.height]="height"
      role="img"
      [attr.aria-label]="summary()"
    >
      @for (tick of ticks(); track tick.value) {
        <line class="forecast-grid" [attr.x1]="padLeft" [attr.x2]="plotRight()" [attr.y1]="tick.y" [attr.y2]="tick.y" />
        <text class="forecast-axis" [attr.x]="padLeft - 8" [attr.y]="tick.y + 4" text-anchor="end">{{ tick.value }}%</text>
      }
      @for (tick of dateTicks(); track tick.x) {
        <text class="forecast-axis" [attr.x]="tick.x" [attr.y]="height - 6" [attr.text-anchor]="tick.anchor">{{ tick.label }}</text>
      }
      <line class="forecast-today" [attr.x1]="nowX()" [attr.x2]="nowX()" [attr.y1]="padTop" [attr.y2]="height - padBottom" />
      <text class="forecast-axis" [attr.x]="nowX() + 6" [attr.y]="padTop + 10">Today</text>
      <line class="forecast-limit" [attr.x1]="padLeft" [attr.x2]="plotRight()" [attr.y1]="limitY()" [attr.y2]="limitY()" />
      <text class="forecast-limit-label" [attr.x]="padLeft + 6" [attr.y]="limitY() - 6">Allowance</text>
      @for (line of lines(); track line.id) {
        <path class="forecast-used" [attr.d]="line.used" [attr.stroke]="line.color" />
        <path class="forecast-projected" [attr.d]="line.projected" [attr.stroke]="line.color" />
        <circle class="forecast-now" [attr.cx]="line.nowX" [attr.cy]="line.nowY" r="4.5" [attr.fill]="line.color" />
        @if (line.runOut; as runOut) {
          <circle class="forecast-run-out" [attr.cx]="runOut.x" [attr.cy]="limitY()" r="5" />
          <text class="forecast-run-out-label" [attr.x]="runOut.x - 8" [attr.y]="limitY() - 8" text-anchor="end">{{ runOut.label }}</text>
        }
      }
      @for (label of endLabels(); track label.id) {
        <text class="forecast-end-label" [attr.x]="plotRight() + 8" [attr.y]="label.y">
          <tspan [attr.fill]="label.color">●</tspan> {{ label.text }}
        </text>
      }
    </svg>
  `,
  styles: [`
    :host { display: block; min-width: 0; width: 100%; }
    .forecast-svg { display: block; width: 100%; overflow: visible; }
    .forecast-grid { stroke: rgba(255, 255, 255, 0.06); }
    .forecast-axis { fill: rgba(255, 255, 255, 0.55); font-size: 11px; font-variant-numeric: tabular-nums; }
    .forecast-today { stroke: rgba(255, 255, 255, 0.16); stroke-dasharray: 2 3; }
    .forecast-limit { stroke: rgba(255, 255, 255, 0.45); stroke-width: 1.5; }
    .forecast-limit-label, .forecast-end-label { fill: rgba(255, 255, 255, 0.78); font-size: 11px; }
    .forecast-end-label { font-size: 12px; }
    .forecast-used, .forecast-projected { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .forecast-projected { stroke-dasharray: 5 4; }
    .forecast-now { stroke: var(--forecast-surface, #08080a); stroke-width: 2; }
    .forecast-run-out { fill: var(--status-warn); stroke: var(--forecast-surface, #08080a); stroke-width: 2; }
    .forecast-run-out-label { fill: var(--status-warn-fg); font-size: 11px; }
  `],
})
export class AllowanceForecastChartComponent {
  readonly series = input.required<ForecastSeries[]>();
  readonly periodStart = input.required<number>();
  readonly periodEnd = input.required<number>();
  readonly now = input.required<number>();

  readonly height = HEIGHT;
  readonly padLeft = PAD.left;
  readonly padTop = PAD.top;
  readonly padBottom = PAD.bottom;
  readonly width = signal(640);
  private readonly locale = inject(LOCALE_ID);

  private readonly padRight = computed(() => (this.series().length > 1 ? 76 : 16));
  readonly plotRight = computed(() => this.width() - this.padRight());

  private readonly x = computed(() => {
    const start = this.periodStart();
    const span = Math.max(1, this.periodEnd() - start);
    const left = PAD.left;
    const plot = Math.max(1, this.plotRight() - left);
    return (time: number) => left + ((Math.min(Math.max(time, start), start + span) - start) / span) * plot;
  });

  private readonly y = (percent: number) =>
    PAD.top + (1 - Math.min(Math.max(percent, 0), Y_MAX) / Y_MAX) * (HEIGHT - PAD.top - PAD.bottom);

  readonly limitY = computed(() => this.y(100));
  readonly nowX = computed(() => this.x()(this.now()));
  readonly ticks = computed(() => TICKS.map(value => ({value, y: this.y(value)})));

  readonly dateTicks = computed(() => {
    const start = this.periodStart();
    const end = this.periodEnd();
    const count = this.width() > 460 ? 5 : 3;
    const format = (time: number) => new Date(time).toLocaleDateString(this.locale, {month: 'short', day: 'numeric'});
    return Array.from({length: count}, (_, index) => {
      const time = start + ((end - start) * index) / (count - 1);
      return {
        x: this.x()(time),
        label: format(index === count - 1 ? end - 1 : time),
        anchor: index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle',
      };
    });
  });

  readonly lines = computed(() => {
    const x = this.x();
    const path = (points: ForecastPoint[]) =>
      points.map((point, index) => `${index ? 'L' : 'M'}${x(point.time).toFixed(1)} ${this.y(point.percent).toFixed(1)}`).join(' ');
    return this.series().map(series => {
      const last = series.used[series.used.length - 1];
      return {
        id: series.id,
        color: series.color,
        used: path(series.used),
        projected: path(series.projected),
        nowX: x(last?.time ?? this.now()),
        nowY: this.y(last?.percent ?? 0),
        runOut: series.runOutAt === null ? null : {
          x: x(series.runOutAt),
          label: `${this.series().length > 1 ? series.label + ' run out ' : 'Runs out '}${new Date(series.runOutAt).toLocaleDateString(this.locale, {month: 'short', day: 'numeric'})}`,
        },
      };
    });
  });

  /** Direct labels at the line ends, nudged apart so they never overlap. */
  readonly endLabels = computed(() => {
    if (this.series().length < 2) {
      return [];
    }
    const labels = this.series()
      .map(series => {
        const last = series.projected[series.projected.length - 1] ?? series.used[series.used.length - 1];
        return {id: series.id, text: series.label, color: series.color, y: this.y(last?.percent ?? 0) + 4};
      })
      .sort((left, right) => left.y - right.y);
    for (let index = 1; index < labels.length; index++) {
      labels[index].y = Math.max(labels[index].y, labels[index - 1].y + 16);
    }
    return labels;
  });

  readonly summary = computed(() => {
    const parts = this.series().map(series => {
      const used = Math.round(series.used[series.used.length - 1]?.percent ?? 0);
      const end = series.runOutAt === null
        ? `projected to reach ${Math.round(series.projected[series.projected.length - 1]?.percent ?? used)}% by the end of the period`
        : `projected to run out on ${new Date(series.runOutAt).toLocaleDateString(this.locale, {dateStyle: 'medium'})}`;
      return `${series.label}: ${used}% of the allowance used, ${end}`;
    });
    return `Allowance used this period. ${parts.join('. ')}.`;
  });

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(entries => {
        const width = entries[0]?.contentRect.width;
        if (width && width > 0) {
          this.width.set(Math.round(width));
        }
      });
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
