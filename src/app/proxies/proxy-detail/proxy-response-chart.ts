import {areaY, d3Curve, defineChart, lineY} from '@tanstack/charts';
import {scaleLinear} from '@tanstack/charts/scales/linear';
import {hlmChartTooltip, HLM_CHART_THEME} from '@spartan-ng/helm/chart';
import {curveMonotoneX} from 'd3-shape';
import {ProxyStatistic} from '../../models/ProxyStatistic';

interface ResponseTimePoint {
  index: number;
  label: string;
  responseTime: number;
}

export function buildProxyResponseChart(statistics: readonly ProxyStatistic[], latest?: ProxyStatistic | null) {
  const history = statistics.length
    ? [...statistics].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    : latest ? [latest] : [];
  if (!history.length) return null;

  const formatter = new Intl.DateTimeFormat(undefined, {hour: '2-digit', minute: '2-digit', second: '2-digit'});
  const points: ResponseTimePoint[] = history.map((statistic, index) => {
    const date = new Date(statistic.created_at);
    return {
      index,
      label: Number.isNaN(date.getTime()) ? '—' : formatter.format(date),
      responseTime: statistic.response_time,
    };
  });
  const values = points.map(point => point.responseTime);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const yDomain = scaleLinear().domain(min === max ? [Math.max(0, min - 1), max + 1] : [min, max]).nice(4).domain();
  const last = points.length - 1;
  const ticks = [...new Set([0, Math.floor(last / 2), last])];
  const primary = 'var(--theme-primary-500)';
  const curve = d3Curve(curveMonotoneX);

  return defineChart({
    marks: [
      areaY(points, {id: 'response-time-fill', x: 'index', y: 'responseTime', y1: yDomain[0], fill: 'var(--theme-primary-soft-bg)', curve}),
      lineY(points, {id: 'response-time', x: 'index', y: 'responseTime', stroke: primary, strokeWidth: 2, points: points.length === 1, curve}),
    ],
    scales: {
      x: {
        scale: () => scaleLinear().domain(last ? [0, last] : [-0.5, 0.5]),
        axis: {line: false, ticks: {values: ticks, size: 0, format: index => points[index]?.label ?? ''}, tickLabels: {fontSize: 10}},
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
    tooltip: hlmChartTooltip<ResponseTimePoint, number, number>({content: focused => {
      const point = focused[0]?.datum;
      return point ? {title: point.label, rows: [{label: 'Response time', value: `${point.responseTime} ms`, color: primary}]} : {rows: []};
    }}),
  });
}
