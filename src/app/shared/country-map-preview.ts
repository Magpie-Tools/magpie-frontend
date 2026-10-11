import {geoArea, geoCentroid, geoMercator, geoPath} from 'd3-geo';
import {CountryFeature, WORLD_FEATURES} from './world-map';

export const COUNTRY_PREVIEW_WIDTH = 360;
export const COUNTRY_PREVIEW_HEIGHT = 220;

export function buildCountryMapPreview(country: CountryFeature) {
  let focus = country.geometry;
  if (focus.type === 'MultiPolygon') {
    // Overseas territories must not move the view away from the main landmass.
    const polygons = focus.coordinates.map(coordinates => ({type: 'Polygon' as const, coordinates}));
    focus = polygons.reduce((largest, polygon) => geoArea(polygon) > geoArea(largest) ? polygon : largest);
  }

  const center = geoCentroid(focus);
  // Rotate longitude before fitting so countries across the date line stay together.
  const projection = geoMercator().rotate([-center[0], 0]).scale(1).translate([0, 0]);
  const path = geoPath(projection);
  const [[left, top], [right, bottom]] = path.bounds(focus);
  const width = COUNTRY_PREVIEW_WIDTH;
  const height = COUNTRY_PREVIEW_HEIGHT;
  const scale = Math.min(600, width * 0.7 / Math.max(right - left, 1e-6), height * 0.65 / Math.max(bottom - top, 1e-6));
  projection.scale(scale).translate([
    width / 2 - scale * (left + right) / 2,
    height / 2 - scale * (top + bottom) / 2,
  ]).clipExtent([[0, 0], [width, height]]);

  const marker = projection(center)!;
  return {
    countries: WORLD_FEATURES.map(feature => ({name: feature.properties.name, path: path(feature)})),
    selectedPath: country.geometry.type === 'Point' ? null : path(country),
    marker,
  };
}
