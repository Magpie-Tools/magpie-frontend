import {createChartScene} from '@tanstack/charts';
import {geoMercator} from 'd3-geo';
import {feature} from 'topojson-client';
import type {GeometryCollection, Topology} from 'topojson-specification';
import atlas from 'world-atlas/countries-110m.json';
import {buildCountryMapChart, CountryMapFeature} from './country-map-chart';

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
});
