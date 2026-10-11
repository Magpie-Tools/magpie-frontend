import {feature} from 'topojson-client';
import worldMap from 'world-atlas/countries-110m.json';
import type {Feature} from 'geojson';
import type {GeometryCollection, Topology} from 'topojson-specification';

export type CountryFeature = Feature & { properties: { name: string } };

const WORLD_TOPO = worldMap as unknown as Topology<{countries: GeometryCollection<{name: string}>}>;
const WORLD_FEATURES_ALL = feature(WORLD_TOPO, WORLD_TOPO.objects.countries).features;
export const WORLD_FEATURES = WORLD_FEATURES_ALL.filter(
  (feat) => (feat.properties?.name ?? '').toLowerCase() !== 'antarctica'
);
export const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'United States of America',
  'united states': 'United States of America',
  'united states of america': 'United States of America',
  uk: 'United Kingdom',
  'south korea': 'South Korea',
  'north korea': 'North Korea',
  russia: 'Russia',
  'czech republic': 'Czechia',
  laos: 'Laos',
  'lao people\'s democratic republic': 'Laos',
  vietnam: 'Vietnam',
  venezuela: 'Venezuela',
  bolivia: 'Bolivia',
  tanzania: 'Tanzania',
  syria: 'Syria',
  iran: 'Iran',
  moldova: 'Moldova',
  palestine: 'Palestine',
  'palestinian territories': 'Palestine',
  macedonia: 'Macedonia',
  'north macedonia': 'Macedonia',
  'bosnia and herzegovina': 'Bosnia and Herz.',
  'saint lucia': 'Saint Lucia',
  'st lucia': 'Saint Lucia',
  'st. lucia': 'Saint Lucia',
  'democratic republic of the congo': 'Dem. Rep. Congo',
  'congo (drc)': 'Dem. Rep. Congo',
  'congo drc': 'Dem. Rep. Congo',
  drc: 'Dem. Rep. Congo',
  'republic of the congo': 'Congo',
  'congo republic': 'Congo',
  congo: 'Congo',
  'dr congo': 'Dem. Rep. Congo',
  ivorycoast: "Côte d'Ivoire",
  "cote d'ivoire": "Côte d'Ivoire",
  'ivory coast': "Côte d'Ivoire",
  swaziland: 'eSwatini',
  eswatini: 'eSwatini',
  'the netherlands': 'Netherlands',
  'trinidad and tobago': 'Trinidad and Tobago'
};

// Centroids from world-atlas/countries-50m.json for regions omitted at 110m.
// Keep their markers without bundling the larger atlas into proxy details.
const SMALL_COUNTRY_LOCATIONS: Array<[string, number, number]> = [
  ['Vatican', 12.4343, 41.9021],
  ['Micronesia', 153.2966, 7.5361],
  ['Marshall Is.', 170.3313, 7.015],
  ['N. Mariana Is.', 145.6193, 15.8288],
  ['U.S. Virgin Is.', -64.8028, 17.9555],
  ['Guam', 144.767, 13.4406],
  ['American Samoa', -170.7179, -14.3046],
  ['S. Geo. and the Is.', -36.4863, -54.4641],
  ['Br. Indian Ocean Ter.', 72.4453, -7.3312],
  ['Saint Helena', -9.7009, -12.3548],
  ['Pitcairn Is.', -128.3167, -24.3649],
  ['Anguilla', -63.066, 18.2243],
  ['Cayman Is.', -80.9129, 19.43],
  ['Bermuda', -64.7558, 32.3131],
  ['British Virgin Is.', -64.4704, 18.5276],
  ['Turks and Caicos Is.', -71.9734, 21.8312],
  ['Montserrat', -62.1856, 16.7404],
  ['Jersey', -2.1272, 49.2181],
  ['Guernsey', -2.5726, 49.4678],
  ['Isle of Man', -4.5388, 54.224],
  ['Tonga', -174.7998, -20.4161],
  ['Singapore', 103.817, 1.359],
  ['Seychelles', 55.476, -4.6601],
  ['São Tomé and Principe', 6.7235, 0.4434],
  ['San Marino', 12.4594, 43.9415],
  ['Samoa', -172.1649, -13.7536],
  ['St. Vin. and Gren.', -61.2008, 13.2251],
  ['Saint Lucia', -60.9696, 13.8946],
  ['St. Kitts and Nevis', -62.6873, 17.2647],
  ['Palau', 134.4056, 7.286],
  ['Niue', -169.8704, -19.0489],
  ['Cook Is.', -159.7871, -21.2195],
  ['Aruba', -69.9827, 12.521],
  ['Curaçao', -68.9721, 12.1957],
  ['Nauru', 166.9326, -0.5189],
  ['Monaco', 7.4073, 43.7526],
  ['Mauritius', 57.5714, -20.2779],
  ['Malta', 14.405, 35.9215],
  ['Maldives', 73.4573, 3.7316],
  ['Liechtenstein', 9.5357, 47.1367],
  ['Kiribati', -167.9217, 0.893],
  ['Grenada', -61.6818, 12.1174],
  ['St. Pierre and Miquelon', -56.3037, 46.9187],
  ['Wallis and Futuna Is.', -177.3469, -13.8898],
  ['St-Martin', -63.0599, 18.0888],
  ['St-Barthélemy', -62.841, 17.8988],
  ['Fr. Polynesia', -144.8045, -14.7283],
  ['Åland', 19.9528, 60.2153],
  ['Dominica', -61.3576, 15.4394],
  ['Faeroe Is.', -6.8808, 62.0527],
  ['Comoros', 43.6844, -11.879],
  ['Macao', 113.509, 22.2231],
  ['Hong Kong', 114.1143, 22.3983],
  ['Cabo Verde', -23.9576, 15.9551],
  ['Barbados', -59.5602, 13.1811],
  ['Bahrain', 50.5425, 26.0417],
  ['Indian Ocean Ter.', 104.8621, -10.6572],
  ['Heard I. and McDonald Is.', 73.52, -53.0872],
  ['Norfolk Island', 167.9497, -29.0516],
  ['Ashmore and Cartier Is.', 123.5838, -12.43],
  ['Antigua and Barb.', -61.7945, 17.2762],
  ['Andorra', 1.5606, 42.542],
  ['Siachen Glacier', 77.1803, 35.3926],
  ['Sint Maarten', -63.0572, 18.0509],
];

const SMALL_COUNTRIES: CountryFeature[] = SMALL_COUNTRY_LOCATIONS.map(([name, longitude, latitude]) => ({
  type: 'Feature', properties: {name}, geometry: {type: 'Point', coordinates: [longitude, latitude]},
}));

const EXTRA_ALIASES: Record<string, string> = {
  'antigua and barbuda': 'Antigua and Barb.',
  'british indian ocean territory': 'Br. Indian Ocean Ter.',
  'british virgin islands': 'British Virgin Is.',
  'cape verde': 'Cabo Verde',
  'cayman islands': 'Cayman Is.',
  'central african republic': 'Central African Rep.',
  'cook islands': 'Cook Is.',
  'dominican republic': 'Dominican Rep.',
  'equatorial guinea': 'Eq. Guinea',
  'falkland islands': 'Falkland Is.',
  'faroe islands': 'Faeroe Is.',
  'french polynesia': 'Fr. Polynesia',
  'french southern territories': 'Fr. S. Antarctic Lands',
  'marshall islands': 'Marshall Is.',
  'northern mariana islands': 'N. Mariana Is.',
  'saint pierre and miquelon': 'St. Pierre and Miquelon',
  'saint kitts and nevis': 'St. Kitts and Nevis',
  'saint vincent and the grenadines': 'St. Vin. and Gren.',
  'sao tome and principe': 'São Tomé and Principe',
  'solomon islands': 'Solomon Is.',
  'south sudan': 'S. Sudan',
  'turks and caicos islands': 'Turks and Caicos Is.',
  'u.s. virgin islands': 'U.S. Virgin Is.',
  'united states virgin islands': 'U.S. Virgin Is.',
  'vatican city': 'Vatican',
  'wallis and futuna': 'Wallis and Futuna Is.',
  'western sahara': 'W. Sahara',
};

function nameKey(name: string): string {
  return name.trim().toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/’/g, "'").replace(/&/g, 'and');
}

const COUNTRIES_BY_NAME = new Map(WORLD_FEATURES.map(country => [nameKey(country.properties.name), country]));
const SMALL_COUNTRIES_BY_NAME = new Map(SMALL_COUNTRIES.map(country => [nameKey(country.properties.name), country]));
const REGION_NAMES = typeof Intl.DisplayNames !== 'undefined'
  ? new Intl.DisplayNames(['en'], {type: 'region', fallback: 'none'})
  : undefined;

/** Resolves dashboard labels and ISO region codes against the bundled world map. */
export function resolveWorldCountry(name: string | null | undefined, includeSmallCountries = false): CountryFeature | undefined {
  let key = nameKey(name ?? '');
  if (!key || ['unknown', 'others', 'n/a', 'unk'].includes(key)) return undefined;

  const lookup = (value: string) => {
    const canonical = nameKey(COUNTRY_ALIASES[value] ?? EXTRA_ALIASES[value] ?? value);
    return COUNTRIES_BY_NAME.get(canonical)
      ?? (includeSmallCountries ? SMALL_COUNTRIES_BY_NAME.get(canonical) : undefined);
  };

  const exact = lookup(key);
  if (exact) return exact;

  if (/^[a-z]{2,3}$/i.test(key) && REGION_NAMES) {
    try {
      const displayName = REGION_NAMES.of(key.toUpperCase());
      if (displayName) {
        key = nameKey(displayName);
        const region = lookup(key);
        if (region) return region;
      }
    } catch {
      // Intl accepts two-letter region codes; unsupported codes have no map.
      return undefined;
    }
  }

  // Retain the dashboard's existing support for shortened country labels.
  return includeSmallCountries ? undefined : WORLD_FEATURES.find(country => {
    const countryKey = nameKey(country.properties.name);
    return countryKey.startsWith(key) || key.startsWith(countryKey);
  });
}
