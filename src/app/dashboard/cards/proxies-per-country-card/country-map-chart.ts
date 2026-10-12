import {defineChart} from '@tanstack/charts';
import {geoShape} from '@tanstack/charts/geo';
import {hlmChartTooltip, HLM_CHART_THEME} from '@spartan-ng/helm/chart';
import {geoContains, geoMercator} from 'd3-geo';
import type {GeoProjection} from 'd3-geo';
import type {Feature} from 'geojson';
import {constrainMapView, INITIAL_MAP_VIEW, MapFrame, MapView} from '../../../shared/map-navigation';

export type CountryMapFeature = Feature & {properties: {name: string; value: number}};

export interface CountryMapFrame extends MapFrame {
  x: number;
  y: number;
  plotWidth: number;
  plotHeight: number;
}

interface CountryMapNavigation {
  view: MapView;
  dragging?: boolean;
  onFrame?: (frame: CountryMapFrame) => void;
}

export function buildCountryMapProjection(
  features: CountryMapFeature[],
  chart: {x: number; y: number; width: number; height: number},
  view: MapView = INITIAL_MAP_VIEW,
) {
  const projection = geoMercator().rotate([-10, 0]).fitExtent(
    [[chart.x, chart.y], [chart.x + chart.width, chart.y + chart.height]],
    {type: 'FeatureCollection', features},
  );
  const scale = projection.scale();
  const [x, y] = projection.translate();
  const frame: CountryMapFrame = {
    width: 1, height: 1, x: chart.x, y: chart.y, plotWidth: chart.width, plotHeight: chart.height,
    worldWidth: 2 * Math.PI * scale / chart.width,
    // Preserve the fitted overview's margins at narrow aspect ratios.
    worldTop: Math.min(0, (y - Math.PI * scale - chart.y) / chart.height),
    worldBottom: Math.max(1, (y + Math.PI * scale - chart.y) / chart.height),
  };
  const constrained = constrainMapView(view, frame);
  // Rotate longitude to wrap seamlessly instead of dragging off the world edge.
  const offsetX = constrained.pan[0] * chart.width + (view.zoom - 1) * (x - chart.x);
  projection.scale(scale * view.zoom).rotate([-10 + offsetX / (scale * view.zoom) * 180 / Math.PI, 0])
    .translate([x, chart.y + (y - chart.y) * view.zoom + constrained.pan[1] * chart.height])
    .clipExtent([[chart.x, chart.y], [chart.x + chart.width, chart.y + chart.height]]);
  return {projection, frame};
}

export function countryMapColor(value: number): string {
  const clamped = Math.min(1, Math.max(0, value));
  const start = [9, 12, 24];
  const end = [180, 225, 255];
  const channel = (index: number) => Math.round(start[index] + (end[index] - start[index]) * clamped);
  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${0.55 + clamped * 0.4})`;
}

export function buildCountryMapChart(
  features: CountryMapFeature[], maxValue: number, format: (value: number) => string,
  navigation?: CountryMapNavigation,
) {
  let projection: GeoProjection | undefined;
  return defineChart({
    marks: [geoShape(features, {
      id: 'countries', key: feature => feature.properties.name,
      projection: ({chart}) => {
        const map = buildCountryMapProjection(features, chart, navigation?.view);
        projection = map.projection;
        navigation?.onFrame?.(map.frame);
        return projection;
      },
      fill: feature => countryMapColor(feature.properties.value / Math.max(maxValue, 1)),
      stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1.1,
    })],
    scales: {x: null, y: null}, margin: 8, theme: HLM_CHART_THEME,
    motion: false, svgAnimation: false,
    // The map frame owns keyboard navigation and suppresses tooltips during a drag.
    keyboard: navigation ? false : undefined,
    pointer: !navigation?.dragging,
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
