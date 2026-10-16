import {createChartScene} from '@tanstack/charts';
import type {ChartTooltipContentContext, SceneNode} from '@tanstack/charts';
import {ProxyStatistic} from '../../models/ProxyStatistic';
import {buildProxyResponseChart} from './proxy-response-chart';

const statistic = (response_time: number, created_at: string, id = 1): ProxyStatistic => ({
  id, response_time, created_at, alive: true, attempt: 1,
  protocol: 'http', anonymity_level: 'elite', judge: 'https://judge.example',
});
const context: ChartTooltipContentContext = {
  pinned: false, xLabel: '', yLabel: '', formatX: String, formatY: String,
};
const flatten = (nodes: readonly SceneNode[]): SceneNode[] => nodes.flatMap(node => node.kind === 'group' ? flatten(node.children) : [node]);

describe('Proxy response-time chart', () => {
  it('sorts checks chronologically without changing the history order', () => {
    const history = [statistic(300, '2026-10-16T12:02:00Z', 2), statistic(100, '2026-10-16T12:01:00Z')];
    const chart = buildProxyResponseChart(history)!;
    const scene = createChartScene(chart, {width: 360, height: 170});
    const points = scene.points.filter(point => point.markId === 'response-time');
    expect(points.map(point => point.datum.responseTime)).toEqual([100, 300]);
    expect(history.map(row => row.id)).toEqual([2, 1]);
    expect(scene.scales['y'].ticks.every(tick => tick.label.endsWith(' ms'))).toBeTrue();
  });

  it('uses theme colors and provides a timestamp and millisecond tooltip', () => {
    const chart = buildProxyResponseChart([statistic(125, '2026-10-16T12:01:00Z')])!;
    const scene = createChartScene(chart, {width: 360, height: 170});
    const point = scene.points.find(point => point.markId === 'response-time')!;
    const nodes = flatten(scene.nodes);
    expect(nodes.some(node => node.kind === 'polyline' && node.style?.stroke === 'var(--theme-primary-500)')).toBeTrue();
    expect(nodes.some(node => node.kind === 'area' && node.style?.fill === 'var(--theme-primary-soft-bg)')).toBeTrue();
    const time = new Intl.DateTimeFormat(undefined, {hour: '2-digit', minute: '2-digit', second: '2-digit'}).format(new Date('2026-10-16T12:01:00Z'));
    if ('content' in chart.tooltip) {
      expect(chart.tooltip.content!([point], context)).toEqual({
        title: time, rows: [{label: 'Response time', value: '125 ms', color: 'var(--theme-primary-500)'}],
      });
    } else fail('Missing response-time tooltip');
  });

  it('falls back to the latest check and renders a single zero-time result', () => {
    const chart = buildProxyResponseChart([], statistic(0, '2026-10-16T12:01:00Z'))!;
    const scene = createChartScene(chart, {width: 240, height: 170});
    const points = scene.points.filter(point => point.markId === 'response-time');
    expect(points.length).toBe(1);
    expect(points[0].datum.responseTime).toBe(0);
    expect(scene.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBeTrue();
    expect(flatten(scene.nodes).some(node => node.kind === 'dot')).toBeTrue();
  });

  it('uses history when both history and a latest check are available', () => {
    const chart = buildProxyResponseChart([statistic(100, '2026-10-16T12:01:00Z')], statistic(500, '2026-10-16T12:02:00Z'))!;
    const scene = createChartScene(chart, {width: 360, height: 170});
    expect(scene.points.filter(point => point.markId === 'response-time').map(point => point.datum.responseTime)).toEqual([100]);
  });

  it('keeps duplicate timestamps separate and limits the time axis to three labels', () => {
    const history = Array.from({length: 150}, (_, index) => statistic(100 + index, '2026-10-16T12:01:00Z', index));
    const scene = createChartScene(buildProxyResponseChart(history)!, {width: 360, height: 170});
    const points = scene.points.filter(point => point.markId === 'response-time');
    expect(points.length).toBe(150);
    expect(new Set(points.map(point => point.x)).size).toBe(150);
    expect(scene.scales['x'].ticks.length).toBe(3);
  });

  it('shows a placeholder label for an invalid timestamp and no chart without checks', () => {
    const scene = createChartScene(buildProxyResponseChart([statistic(100, 'invalid')])!, {width: 240, height: 170});
    expect(scene.scales['x'].ticks.map(tick => tick.label)).toEqual(['—']);
    expect(buildProxyResponseChart([])).toBeNull();
  });
});
