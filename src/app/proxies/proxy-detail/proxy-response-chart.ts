import {areaY, d3Curve, defineChart, lineY} from '@tanstack/charts';
import {scaleLinear} from '@tanstack/charts/scales/linear';
import {hlmChartTooltip, HLM_CHART_THEME} from '@spartan-ng/helm/chart';
import {curveMonotoneX} from 'd3-shape';
import {ProxyStatistic} from '../../models/ProxyStatistic';

interface ResponseTimePoint {
  index: number;
  label: string;
  title: string;
  responseTime: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildProxyResponseChart(statistics: readonly ProxyStatistic[], latest?: ProxyStatistic | null, locale = 'de-DE') {
  const history = statistics.length
    ? [...statistics].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    : latest ? [latest] : [];
  if (!history.length) return null;

  // Histories longer than a day need the date on the axis; shorter ones only the time.
  const times = history.map(statistic => Date.parse(statistic.created_at)).filter(Number.isFinite);
  const spansDays = times.length > 1 && Math.max(...times) - Math.min(...times) > DAY_MS;
  const axisFormatter = new Intl.DateTimeFormat(locale, spansDays
    ? {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}
    : {hour: '2-digit', minute: '2-digit'});
  const tooltipFormatter = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'medium'});
  const points: ResponseTimePoint[] = history.map((statistic, index) => {
    const date = new Date(statistic.created_at);
    const valid = !Number.isNaN(date.getTime());
    return {
      index,
      label: valid ? axisFormatter.format(date) : '—',
      title: valid ? tooltipFormatter.format(date) : '—',
      responseTime: statistic.response_time,
    };
  });
  // A zero baseline keeps small variations from looking dramatic (50 ms flat stays flat).
  const max = Math.max(...points.map(point => point.responseTime), 1);
  const yDomain = scaleLinear().domain([0, max]).nice(4).domain();
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
        // End labels anchor inward and sit a little lower so they never touch the "0 ms" axis label.
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
    tooltip: hlmChartTooltip<ResponseTimePoint, number, number>({content: focused => {
      const point = focused[0]?.datum;
      return point ? {title: point.title, rows: [{label: 'Response time', value: `${point.responseTime} ms`, color: primary}]} : {rows: []};
    }}),
  });
}
