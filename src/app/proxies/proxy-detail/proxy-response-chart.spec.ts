import {createChartScene} from '@tanstack/charts';
import type {ChartTooltipContentContext, SceneNode} from '@tanstack/charts';
import {ProxyStatisticHour, ProxyStatisticHours} from '../../models/ProxyStatisticHour';
import {buildProxyHourlyChart} from './proxy-response-chart';

const since = '2026-10-16T10:00:00Z';
const hour = (offset: number, avg: number, checks = 4, failed = 0): ProxyStatisticHour => ({
  hour: new Date(Date.parse(since) + offset * 3_600_000).toISOString(), checks, failed, avg_response_time: avg,
});
const data = (...hours: ProxyStatisticHour[]): ProxyStatisticHours => ({since, hours});
const context: ChartTooltipContentContext = {
  pinned: false, xLabel: '', yLabel: '', formatX: String, formatY: String,
};
const flatten = (nodes: readonly SceneNode[]): SceneNode[] => nodes.flatMap(node => node.kind === 'group' ? flatten(node.children) : [node]);

describe('Proxy hourly response-time chart', () => {
  it('places each hour on the window and labels the latency axis in ms', () => {
    const chart = buildProxyHourlyChart(data(hour(0, 100), hour(2, 300)), 3)!;
    const scene = createChartScene(chart, {width: 360, height: 170});
    const points = scene.points.filter(point => point.markId === 'response-time');
    expect(points.map(point => point.datum.responseTime)).toEqual([100, 300]);
    expect(points.map(point => point.datum.index)).toEqual([0, 2]);
    expect(scene.scales['y'].ticks[0].label).toBe('0 ms');
    expect(scene.scales['y'].ticks.every(tick => tick.label.endsWith(' ms'))).toBeTrue();
  });

  it('leaves a gap for hours where every check failed', () => {
    const chart = buildProxyHourlyChart(data(hour(0, 100), hour(1, 0, 3, 3), hour(2, 200)), 3)!;
    const scene = createChartScene(chart, {width: 360, height: 170});
    const points = scene.points.filter(point => point.markId === 'response-time');
    expect(points.map(point => point.datum.index)).toEqual([0, 2]);
    expect(scene.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBeTrue();
    // Both hours sit between gaps, so each is drawn as a dot.
    expect(scene.points.filter(point => point.markId === 'response-time-isolated').length).toBe(2);
  });

  it('draws no dots for hours that are part of a line', () => {
    const scene = createChartScene(buildProxyHourlyChart(data(hour(0, 100), hour(1, 200), hour(3, 300)), 4)!, {width: 360, height: 170});
    const dots = scene.points.filter(point => point.markId === 'response-time-isolated');
    expect(dots.map(point => point.datum.index)).toEqual([3]);
  });

  it('uses theme colors and explains the hour in the tooltip', () => {
    const chart = buildProxyHourlyChart(data(hour(0, 1250, 5, 1)), 1)!;
    const scene = createChartScene(chart, {width: 360, height: 170});
    const point = scene.points.find(point => point.markId === 'response-time')!;
    const nodes = flatten(scene.nodes);
    expect(nodes.some(node => node.kind === 'area' && node.style?.fill === 'var(--theme-primary-soft-bg)')).toBeTrue();
    expect(nodes.some(node => node.kind === 'dot')).toBeTrue();
    if ('content' in chart.tooltip) {
      const content = chart.tooltip.content!([point], context) as {title: string; rows: {label: string; value: string}[]};
      expect(content.rows.map(row => [row.label, row.value])).toEqual([
        ['Average response', `${new Intl.NumberFormat('de-DE').format(1250)} ms`],
        ['Checks', '5'],
        ['Failed', '1'],
      ]);
      expect(content.title).toContain('–');
    } else fail('Missing response-time tooltip');
  });

  it('dates the axis for multi-day windows and limits it to three labels', () => {
    const scene = createChartScene(buildProxyHourlyChart(data(hour(0, 50), hour(71, 50)), 72)!, {width: 360, height: 170});
    expect(scene.scales['x'].ticks.length).toBe(3);
    const dayLabel = new Intl.DateTimeFormat('de-DE', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})
      .format(new Date(since));
    expect(scene.scales['x'].ticks[0].label).toBe(dayLabel);
  });

  it('returns no chart without data or without a successful check', () => {
    expect(buildProxyHourlyChart(null, 24)).toBeNull();
    expect(buildProxyHourlyChart(data(), 24)).toBeNull();
    expect(buildProxyHourlyChart(data(hour(0, 0, 2, 2)), 24)).toBeNull();
    expect(buildProxyHourlyChart({since: 'invalid', hours: []}, 24)).toBeNull();
  });
});
