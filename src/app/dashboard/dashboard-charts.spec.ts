import {createChartScene} from '@tanstack/charts';
import type {ChartTooltipContentContext, SceneNode} from '@tanstack/charts';
import {buildInventoryChart, buildLatencyChart, buildMetricChart, buildReputationChart, InventoryLabels, LatencyPoint} from './dashboard-charts';

const tooltipContext: ChartTooltipContentContext = {
  pinned: false, xLabel: '', yLabel: '', formatX: String, formatY: String,
};
const labels: InventoryLabels = {
  proxiesLabel: 'Proxies', limitLabel: 'Limit', tooltipProxiesLabel: 'Proxies',
  tooltipGainedLabel: 'Gained', tooltipLostLabel: 'Lost', tooltipLimitLabel: 'Limit',
};
const format = (value: number) => new Intl.NumberFormat('de-DE').format(value);
const flatten = (nodes: readonly SceneNode[]): SceneNode[] => nodes.flatMap(node => node.kind === 'group' ? flatten(node.children) : [node]);

describe('Spartan dashboard chart definitions', () => {
  it('keeps the current metric value and a localized value-only tooltip', () => {
    const chart = buildMetricChart([{index: 0, value: 900}, {index: 1, value: 1000}], '#4ade80', format);
    const scene = createChartScene(chart, {width: 320, height: 52});
    const current = scene.points.find(point => point.datum.value === 1000)!;
    expect(current).toBeDefined();
    if ('format' in chart.tooltip) expect(chart.tooltip.format!(current, tooltipContext)).toBe('1.000');
    expect(flatten(scene.nodes).some(node => node.kind === 'label')).toBeFalse();
  });

  it('shows gains, losses, timestamps, and the limit when focusing inventory', () => {
    const data = [
      {index: 0, label: 'Oct 01', count: 1400, gained: 1400, lost: 0},
      {index: 1, label: 'Oct 02', count: 1200, gained: 0, lost: 200},
    ];
    const chart = buildInventoryChart(data, 2000, labels, format);
    const scene = createChartScene(chart, {width: 600, height: 384});
    const point = scene.points.find(point => point.markId === 'inventory' && point.datum.index === 1)!;
    expect(scene.scales['y'].domain[1]).toBeGreaterThanOrEqual(2000);
    expect(scene.scales['x'].ticks.map(tick => tick.label)).toEqual(['Oct 01', 'Oct 02']);
    const limitPoint = scene.points.find(point => point.markId === 'limit' && point.datum.index === 1)!;
    const expected = {
      title: 'Oct 02', rows: [
        {label: 'Proxies', value: '1.200', color: '#3b82f6'},
        {label: 'Gained', value: '0'},
        {label: 'Lost', value: '200'},
        {label: 'Limit', value: '2.000', color: '#f59e0b'},
      ],
    };
    if ('content' in chart.tooltip) {
      expect(chart.tooltip.content!([point], tooltipContext)).toEqual(expected);
      expect(chart.tooltip.content!([limitPoint], tooltipContext)).toEqual(expected);
    }
  });

  it('renders a single empty-history point without a limit series', () => {
    const chart = buildInventoryChart([{index: 0, label: 'No data', count: 0, gained: 0, lost: 0}], null, labels, format);
    const scene = createChartScene(chart, {width: 320, height: 384});
    expect(scene.points.some(point => point.markId === 'inventory')).toBeTrue();
    expect(scene.points.some(point => point.markId === 'limit')).toBeFalse();
    expect(scene.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBeTrue();
  });

  it('preserves country colors, reputation shapes, and proxy tooltip details', () => {
    const data: LatencyPoint[] = ['good', 'neutral', 'bad', 'unknown'].map((reputation, index) => ({
      x: index < 2 ? 1 : 2, y: 50 + index * 20, rank: index + 1, proxy: `192.0.2.${index + 1}:8080`,
      country: index < 2 ? 'Germany' : 'France', reputation, reputationScore: 70,
    }));
    const chart = buildLatencyChart(data, ['Germany', 'France'], ['#00ff00', '#0000ff'], format);
    const scene = createChartScene(chart, {width: 600, height: 352});
    const nodes = flatten(scene.nodes).filter(node => 'interaction' in node && node.interaction?.point?.markId === 'latency');
    expect(nodes.map(node => node.kind)).toEqual(['dot', 'area', 'area', 'area']);
    expect(scene.points.map(point => point.color)).toEqual(['#00ff00', '#00ff00', '#0000ff', '#0000ff']);
    expect(scene.scales['x'].ticks.map(tick => tick.label)).toEqual(['Germany', 'France']);
    if ('content' in chart.tooltip) expect(chart.tooltip.content!([scene.points[2]], tooltipContext)).toEqual({
      title: '#3 192.0.2.3:8080', rows: [
        {label: 'Latency', value: '90 ms'}, {label: 'Country', value: 'France'},
        {label: 'Reputation', value: 'Bad, score 70.0'},
      ],
    });
  });

  it('retains reputation counts and percentage tooltips', () => {
    const chart = buildReputationChart([
      {label: 'Good', value: 1200, color: '#22c55e'}, {label: 'Unknown', value: 400, color: '#94a3b8'},
    ], format);
    const scene = createChartScene(chart, {width: 600, height: 288});
    const point = scene.points.find(point => point.markId === 'reputation' && point.datum.label === 'Good')!;
    expect(point.color).toBe('#22c55e');
    if ('format' in chart.tooltip) expect(chart.tooltip.format!(point, tooltipContext)).toBe('Good: 1.200 (75.0%)');
  });
});
