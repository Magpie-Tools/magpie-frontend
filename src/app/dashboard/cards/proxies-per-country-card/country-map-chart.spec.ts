import {createChartScene} from '@tanstack/charts';
import {geoMercator} from 'd3-geo';
import {feature} from 'topojson-client';
import type {GeometryCollection, Topology} from 'topojson-specification';
import atlas from 'world-atlas/countries-110m.json';
import {zoomMapView} from '../../../shared/map-navigation';
import {buildCountryMapChart, buildCountryMapProjection, CountryMapFeature, CountryMapFrame} from './country-map-chart';

describe('Spartan country map interactions', () => {
  const topology = atlas as unknown as Topology<{countries: GeometryCollection<{name: string}>}>;
  const features: CountryMapFeature[] = feature(topology, topology.objects.countries).features
    .filter(country => country.properties.name !== 'Antarctica')
    .map(country => ({...country, properties: {...country.properties, value: country.properties.name === 'United States of America' ? 1200 : 0}}));

  it('focuses the country boundary rather than a nearby centroid at desktop and mobile sizes', () => {
    const chart = buildCountryMapChart(features, 1200, String);
    const focus = chart.focus;
    if (!focus || typeof focus !== 'object') throw new Error('Expected geographic focus strategy');
    for (const width of [800, 390]) {
      const scene = createChartScene(chart, {width, height: 320});
      const {x, y, width: plotWidth, height: plotHeight} = scene.chart;
      const projection = geoMercator().rotate([-10, 0]).fitExtent(
        [[x, y], [x + plotWidth, y + plotHeight]], {type: 'FeatureCollection', features},
      );
      const position = projection([-100, 40])!;
      const focused = focus.resolve(scene.points, {x: position[0], y: position[1], maxDistance: 0});
      expect(focused.length).toBe(1);
      expect(focused[0].datum.properties.name).toBe('United States of America');
      if ('format' in chart.tooltip) expect(chart.tooltip.format!(focused[0], {
        pinned: false, xLabel: '', yLabel: '', formatX: String, formatY: String,
      })).toBe('United States of America: 1200');
      const ocean = projection([0, 0])!;
      expect(focus.resolve(scene.points, {x: ocean[0], y: ocean[1], maxDistance: 100})).toEqual([]);
    }
  });

  it('keeps geographic focus and counts accurate after panning, zooming, and resizing', () => {
    for (const width of [800, 390]) {
      const bounds = createChartScene(buildCountryMapChart(features, 1200, String), {width, height: 320}).chart;
      const center: [number, number] = [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2];
      const initial = buildCountryMapProjection(features, bounds).projection([-100, 40])!;
      const view = {zoom: 3, pan: [
        (center[0] - bounds.x - (initial[0] - bounds.x) * 3) / bounds.width,
        (center[1] - bounds.y - (initial[1] - bounds.y) * 3) / bounds.height,
      ] as [number, number]};
      const chart = buildCountryMapChart(features, 1200, String, {view});
      const scene = createChartScene(chart, {width, height: 320});
      if (!chart.focus || typeof chart.focus !== 'object') throw new Error('Expected geographic focus strategy');
      const focused = chart.focus.resolve(scene.points, {x: center[0], y: center[1], maxDistance: 0});
      expect(focused.length).toBe(1);
      expect(focused[0].datum.properties.name).toBe('United States of America');
      if ('format' in chart.tooltip) expect(chart.tooltip.format!(focused[0], {
        pinned: false, xLabel: '', yLabel: '', formatX: String, formatY: String,
      })).toBe('United States of America: 1200');
    }
  });

  it('keeps the same geographic location under a wheel zoom anchor', () => {
    const bounds = {x: 8, y: 8, width: 784, height: 304};
    const view = {zoom: 2, pan: [-0.3, -0.5] as [number, number]};
    const anchor: [number, number] = [0.35, 0.6];
    const pixel: [number, number] = [bounds.x + anchor[0] * bounds.width, bounds.y + anchor[1] * bounds.height];
    const before = buildCountryMapProjection(features, bounds, view).projection.invert!(pixel)!;
    const after = buildCountryMapProjection(features, bounds, zoomMapView(view, 1.25, anchor, 1)).projection.invert!(pixel)!;
    expect(after[0]).toBeCloseTo(before[0], 5);
    expect(after[1]).toBeCloseTo(before[1], 5);
  });

  it('wraps longitude across repeated drags without losing countries at the date line', () => {
    const bounds = {x: 8, y: 8, width: 784, height: 304};
    const base = buildCountryMapProjection(features, bounds);
    const zoom = 3;
    const location: [number, number] = [178, -17.8];
    const initial = base.projection(location)!;
    const pan: [number, number] = [
      0.5 - (initial[0] - bounds.x) / bounds.width * zoom,
      0.5 - (initial[1] - bounds.y) / bounds.height * zoom,
    ];
    for (const turns of [-3, 0, 3]) {
      const view = {zoom, pan: [pan[0] + turns * base.frame.worldWidth * zoom, pan[1]] as [number, number]};
      const chart = buildCountryMapChart(features, 1200, String, {view});
      const scene = createChartScene(chart, {width: 800, height: 320});
      if (!chart.focus || typeof chart.focus !== 'object') throw new Error('Expected geographic focus strategy');
      const focused = chart.focus.resolve(scene.points, {x: 400, y: 160, maxDistance: 0});
      expect(focused[0]?.datum.properties.name).toBe('Fiji');
    }
  });

  it('exposes the current layout while suppressing hover focus during a drag', () => {
    let frame: CountryMapFrame | undefined;
    const chart = buildCountryMapChart(features, 1200, String, {
      view: {zoom: 2, pan: [0, 0]}, dragging: true, onFrame: value => { frame = value; },
    });
    const scene = createChartScene(chart, {width: 800, height: 320});
    expect(frame?.plotWidth).toBe(scene.chart.width);
    expect(frame?.plotHeight).toBe(scene.chart.height);
    expect(chart.pointer).toBeFalse();
    expect(chart.keyboard).toBeFalse();
  });
});
