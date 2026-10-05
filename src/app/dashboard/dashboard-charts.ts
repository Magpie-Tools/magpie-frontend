import {areaY, barX, d3Curve, defineChart, dot, lineY} from '@tanstack/charts';
import type {ChartMark, SceneNode} from '@tanstack/charts';
import {scaleLinear} from '@tanstack/charts/scales/linear';
import {scaleBand} from '@tanstack/charts/scales/band';
import {hlmChartTooltip, HLM_CHART_THEME} from '@spartan-ng/helm/chart';
import {curveMonotoneX} from 'd3-shape';

const chartTheme = {...HLM_CHART_THEME, grid: 'rgba(148, 163, 184, 0.15)'};
const smoothCurve = d3Curve(curveMonotoneX);
export const REPUTATION_COLORS = ['#22c55e', '#f97316', '#ef4444', '#94a3b8'];

export interface MetricPoint { index: number; value: number; }
export interface InventoryPoint {
  index: number;
  label: string;
  count: number;
  gained: number;
  lost: number;
}
export interface InventoryLabels {
  proxiesLabel: string;
  limitLabel: string;
  tooltipProxiesLabel: string;
  tooltipGainedLabel: string;
  tooltipLostLabel: string;
  tooltipLimitLabel: string;
}
export interface LatencyPoint {
  x: number;
  y: number;
  rank: number;
  proxy: string;
  country: string;
  reputation: string;
  reputationScore: number;
  latestCheck?: string;
}
export interface ReputationPoint { label: string; value: number; color: string; }

export function buildMetricChart(points: MetricPoint[], color: string, format: (value: number) => string) {
  return defineChart({
    marks: [
      areaY(points, {id: 'metric-fill', x: 'index', y: 'value', fill: color, fillOpacity: 0.15, curve: smoothCurve}),
      lineY(points, {id: 'metric', x: 'index', y: 'value', stroke: color, strokeWidth: 2, curve: smoothCurve}),
    ],
    scales: {x: {scale: scaleLinear, axis: false}, y: {scale: scaleLinear, axis: false}},
    margin: {top: 2, right: 0, bottom: 0, left: 0},
    theme: chartTheme,
    tooltip: hlmChartTooltip<MetricPoint, number, number>({format: point => format(point.datum.value)}),
  });
}

export function buildInventoryChart(points: InventoryPoint[], limit: number | null, labels: InventoryLabels, format: (value: number) => string) {
  const limitPoints = limit === null ? [] : points.map(point => ({...point, count: limit}));
  const max = Math.max(1, ...points.map(point => point.count), limit ?? 0);
  return defineChart({
    marks: [
      areaY(points, {id: 'inventory-fill', x: 'index', y: 'count', fill: '#3b82f6', fillOpacity: 0.2, curve: smoothCurve}),
      lineY(points, {id: 'inventory', x: 'index', y: 'count', stroke: '#3b82f6', strokeWidth: 2, points: true, curve: smoothCurve}),
      lineY(limitPoints, {id: 'limit', x: 'index', y: 'count', stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '5 5'}),
    ],
    scales: {
      x: {scale: scaleLinear, axis: {ticks: {values: points.map(point => point.index), format: value => points[Math.round(value)]?.label ?? ''}, tickLabels: {rotate: points.length > 10 ? -35 : 0}}},
      y: {scale: () => scaleLinear().domain([0, max]), nice: true, grid: true, axis: {ticks: {format}}},
    },
    theme: chartTheme,
    focus: 'group-x',
    tooltip: hlmChartTooltip<InventoryPoint, number, number>({content: focused => {
      const focusedIndex = focused[0]?.datum.index;
      const point = points.find(point => point.index === focusedIndex);
      if (!point) return {rows: []};
      return {
        title: point.label,
        rows: [
          {label: labels.tooltipProxiesLabel, value: format(point.count), color: '#3b82f6'},
          {label: labels.tooltipGainedLabel, value: format(point.gained)},
          {label: labels.tooltipLostLabel, value: format(point.lost)},
          ...(limit === null ? [] : [{label: labels.tooltipLimitLabel, value: format(limit), color: '#f59e0b'}]),
        ],
      };
    }}),
  });
}

/** Keeps the existing reputation shapes while using TanStack's scale and focus handling. */
function reputationDots(points: LatencyPoint[]): ChartMark<LatencyPoint, number, number> {
  const mark = dot(points, {id: 'latency', x: 'x', y: 'y', key: 'proxy', color: 'country', r: 6, stroke: '#0f172a', strokeWidth: 1.5});
  const shape = (node: SceneNode): SceneNode => {
    if (node.kind === 'group') return {...node, children: node.children.map(shape)};
    if (node.kind !== 'dot' || !node.interaction?.point) return node;
    const reputation = points[node.interaction.point.datumIndex]?.reputation;
    if (reputation === 'good') return node;
    const {x, y, radius: r} = node;
    const vertices: [number, number][] = reputation === 'neutral'
      ? [[x, y - r], [x + r, y + r], [x - r, y + r]]
      : reputation === 'bad'
        ? [[x, y - r], [x + r, y], [x, y + r], [x - r, y]]
        : [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]];
    return {kind: 'area', key: node.key, points: vertices, style: node.style, interaction: node.interaction};
  };
  return {...mark, initialize: context => {
    const initialized = mark.initialize(context);
    return {...initialized, render: context => {
      const scene = initialized.render(context);
      return {...scene, nodes: scene.nodes.map(shape)};
    }};
  }};
}

export function buildLatencyChart(points: LatencyPoint[], countries: string[], colors: string[], format: (value: number) => string) {
  const max = Math.max(1, ...points.map(point => point.y));
  return defineChart({
    marks: [reputationDots(points)],
    scales: {
      x: {scale: () => scaleLinear().domain([0.5, Math.max(countries.length, 1) + 0.5]), axis: {
        label: 'Country', ticks: {values: countries.map((_, index) => index + 1), format: value => {
          const label = countries[Math.round(value) - 1] ?? '';
          return label.length > 12 ? `${label.slice(0, 11)}...` : label;
        }},
        tickLabels: {rotate: countries.length > 10 ? -35 : 0},
      }},
      y: {scale: () => scaleLinear().domain([0, max]), nice: true, grid: true, axis: {label: 'Response time (ms)', ticks: {format: value => `${format(value)} ms`}}},
    },
    color: {domain: countries, range: colors},
    theme: chartTheme,
    tooltip: hlmChartTooltip<LatencyPoint, number, number>({content: focused => {
      const point = focused[0]?.datum;
      if (!point) return {rows: []};
      const reputation = point.reputation === 'bad' ? 'Bad' : point.reputation.charAt(0).toUpperCase() + point.reputation.slice(1);
      return {title: `#${point.rank} ${point.proxy}`, rows: [
        {label: 'Latency', value: `${format(point.y)} ms`},
        {label: 'Country', value: point.country},
        {label: 'Reputation', value: `${reputation}, score ${point.reputationScore.toFixed(1)}`},
      ]};
    }}),
  });
}

export function buildReputationChart(points: ReputationPoint[], format: (value: number) => string) {
  const total = points.reduce((sum, point) => sum + point.value, 0);
  return defineChart({
    marks: [
      barX(points, {id: 'reputation-stems', x: 'value', y: 'label', color: 'label', fillOpacity: 0.35, maxThickness: 8, radius: 4}),
      dot(points, {id: 'reputation', x: 'value', y: 'label', color: 'label', r: 9, stroke: '#0f172a', strokeWidth: 2}),
    ],
    scales: {
      x: {scale: () => scaleLinear().domain([0, Math.max(1, ...points.map(point => point.value))]), nice: true, grid: true, axis: {ticks: {format}}},
      y: {scale: () => scaleBand<string>().domain(points.map(point => point.label)).padding(0.4)},
    },
    color: {domain: points.map(point => point.label), range: points.map(point => point.color)},
    theme: chartTheme,
    tooltip: hlmChartTooltip<ReputationPoint, number, string>({format: point => {
      const value = point.datum.value;
      return `${point.datum.label}: ${format(value)} (${total > 0 ? (value / total * 100).toFixed(1) : '0.0'}%)`;
    }}),
  });
}
