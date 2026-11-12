import {areaY, d3Curve, defineChart, dot, lineY} from '@tanstack/charts';
import {scaleLinear} from '@tanstack/charts/scales/linear';
import {hlmChartTooltip, HLM_CHART_THEME} from '@spartan-ng/helm/chart';
import {curveMonotoneX} from 'd3-shape';
import {ProxyStatisticHours} from '../../models/ProxyStatisticHour';

interface HourlyResponsePoint {
  index: number;
  label: string;
  title: string;
  /** Average of the hour's successful checks; null breaks the line. */
  responseTime: number | null;
  checks: number;
  failed: number;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Average response time per hour across the window. Hours without a successful check leave a gap,
 * so an outage reads as a break in the line instead of a drop to zero.
 */
export function buildProxyHourlyChart(data: ProxyStatisticHours | null, windowHours: number, locale = 'de-DE') {
  const since = data ? Date.parse(data.since) : NaN;
  if (!data || !Number.isFinite(since) || windowHours < 1) return null;

  const byStart = new Map<number, {checks: number; failed: number; avg: number}>();
  for (const bucket of data.hours) {
    const start = Date.parse(bucket.hour);
    if (Number.isFinite(start)) byStart.set(start, {checks: bucket.checks, failed: bucket.failed, avg: bucket.avg_response_time});
  }

  const axisFormatter = new Intl.DateTimeFormat(locale, windowHours > 24
    ? {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}
    : {hour: '2-digit', minute: '2-digit'});
  const titleFormatter = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short'});
  const timeFormatter = new Intl.DateTimeFormat(locale, {hour: '2-digit', minute: '2-digit'});
  const points: HourlyResponsePoint[] = Array.from({length: windowHours}, (_, index) => {
    const start = since + index * HOUR_MS;
    const bucket = byStart.get(start);
    const passed = bucket ? bucket.checks - bucket.failed : 0;
    return {
      index,
      label: axisFormatter.format(start),
      title: `${titleFormatter.format(start)}–${timeFormatter.format(start + HOUR_MS)}`,
      responseTime: bucket && passed > 0 ? bucket.avg : null,
      checks: bucket?.checks ?? 0,
      failed: bucket?.failed ?? 0,
    };
  });
  const measured = points.filter(point => point.responseTime !== null);
  if (!measured.length) return null;
  // An hour between two gaps has no neighbour to draw a line to, so it gets a dot instead.
  const isolated = measured.filter(point =>
    points[point.index - 1]?.responseTime == null && points[point.index + 1]?.responseTime == null);

  // A zero baseline keeps small variations from looking dramatic (50 ms flat stays flat).
  const max = Math.max(...measured.map(point => point.responseTime ?? 0), 1);
  const yDomain = scaleLinear().domain([0, max]).nice(4).domain();
  const last = points.length - 1;
  const ticks = [...new Set([0, Math.floor(last / 2), last])];
  const primary = 'var(--theme-primary-500)';
  const curve = d3Curve(curveMonotoneX);
  const number = new Intl.NumberFormat(locale);

  return defineChart({
    marks: [
      areaY(points, {id: 'response-time-fill', x: 'index', y: 'responseTime', y1: yDomain[0], fill: 'var(--theme-primary-soft-bg)', curve}),
      lineY(points, {id: 'response-time', x: 'index', y: 'responseTime', stroke: primary, strokeWidth: 2, curve}),
      dot(isolated, {id: 'response-time-isolated', x: 'index', y: 'responseTime', r: 2.5, fill: primary}),
    ],
    scales: {
      x: {
        scale: () => scaleLinear().domain(last ? [0, last] : [-0.5, 0.5]),
        // End labels anchor inward so they never touch the "0 ms" axis label.
        axis: {line: false, ticks: {values: ticks, size: 0, padding: 8, format: index => points[index]?.label ?? ''}, tickLabels: {
          fontSize: 10,
          anchor: ({value}) => value === 0 && last > 0 ? 'start' : value === last && last > 0 ? 'end' : 'middle',
        }},
      },
      y: {
        scale: () => scaleLinear().domain(yDomain), grid: true,
        axis: {line: false, ticks: {count: 4, size: 0, format: value => `${value} ms`}, tickLabels: {fontSize: 10}},
      },
    },
    theme: {
      ...HLM_CHART_THEME,
      muted: 'var(--theme-primary-200)',
      grid: 'rgba(var(--theme-primary-500-rgb), 0.18)',
    },
    focus: 'group-x',
    tooltip: hlmChartTooltip<HourlyResponsePoint, number, number>({content: focused => {
      const point = focused[0]?.datum;
      if (!point) return {rows: []};
      const rows = [{label: 'Average response', value: point.responseTime === null ? '—' : `${number.format(point.responseTime)} ms`, color: primary}];
      rows.push({label: 'Checks', value: number.format(point.checks), color: 'var(--theme-primary-200)'});
      if (point.failed) rows.push({label: 'Failed', value: number.format(point.failed), color: 'var(--status-bad)'});
      return {title: point.title, rows};
    }}),
  });
}
