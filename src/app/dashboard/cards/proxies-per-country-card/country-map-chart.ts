import {defineChart} from '@tanstack/charts';
import {geoShape} from '@tanstack/charts/geo';
import {hlmChartTooltip, HLM_CHART_THEME} from '@spartan-ng/helm/chart';
import {geoContains, geoMercator} from 'd3-geo';
import type {GeoProjection} from 'd3-geo';
import type {Feature} from 'geojson';

export type CountryMapFeature = Feature & {properties: {name: string; value: number}};

export function countryMapColor(value: number): string {
  const clamped = Math.min(1, Math.max(0, value));
  const start = [9, 12, 24];
  const end = [180, 225, 255];
  const channel = (index: number) => Math.round(start[index] + (end[index] - start[index]) * clamped);
  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${0.55 + clamped * 0.4})`;
}

export function buildCountryMapChart(features: CountryMapFeature[], maxValue: number, format: (value: number) => string) {
  let projection: GeoProjection | undefined;
  return defineChart({
    marks: [geoShape(features, {
      id: 'countries', key: feature => feature.properties.name,
      projection: ({chart, data}) => {
        projection = geoMercator().rotate([-10, 0]).fitExtent(
          [[chart.x, chart.y], [chart.x + chart.width, chart.y + chart.height]],
          {type: 'FeatureCollection', features: [...data]},
        );
        return projection;
      },
      fill: feature => countryMapColor(feature.properties.value / Math.max(maxValue, 1)),
      stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1.1,
    })],
    scales: {x: null, y: null}, margin: 8, theme: HLM_CHART_THEME,
    // TanStack 0.16 geoShape exposes centroids. Resolve pointer focus against
    // the original boundaries so islands and large countries keep exact hits.
    focus: {
      resolve: (points, context) => {
        const location = projection?.invert?.([context.x, context.y]);
        if (!location) return [];
        const point = points.find(point => geoContains(point.datum, location));
        return point ? [point] : [];
      },
      group: (_points, context) => [context.point],
      navigation: points => [...points].sort((a, b) => a.datum.properties.name.localeCompare(b.datum.properties.name)),
    },
    focusRing: false,
    tooltip: hlmChartTooltip<CountryMapFeature, number, number>({
      anchor: 'pointer',
      format: point => `${point.datum.properties.name}: ${format(point.datum.properties.value)}`,
    }),
  });
}
