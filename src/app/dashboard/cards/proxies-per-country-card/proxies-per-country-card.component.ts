import {HlmCardImports} from '@spartan-ng/helm/card';
import {DialogComponent} from '../../../shared/ui/dialog.component';
import {DashboardChartComponent} from '../../../shared/ui/dashboard-chart.component';
import type {DashboardChartDefinition} from '../../../shared/ui/dashboard-chart.component';
import {buildCountryMapChart, CountryMapFeature} from './country-map-chart';
import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {DecimalPipe} from '@angular/common';
import {FormsModule} from '@angular/forms';

import {feature} from 'topojson-client';
import worldMap from 'world-atlas/countries-110m.json';
import type {Feature} from 'geojson';
import type {GeometryCollection, Topology} from 'topojson-specification';

interface CountryBreakdown {
  name: string;
  percentage: string | number;
  value?: number;
  color?: string;
}

type CountryFeature = Feature & { properties: { name: string } };

const WORLD_TOPO = worldMap as unknown as Topology<{countries: GeometryCollection<{name: string}>}>;
const WORLD_FEATURES_ALL = feature(WORLD_TOPO, WORLD_TOPO.objects.countries).features;
const WORLD_FEATURES = WORLD_FEATURES_ALL.filter(
  (feat) => (feat.properties?.name ?? '').toLowerCase() !== 'antarctica'
);
const FEATURE_BY_NAME = new Map<string, CountryFeature>();

WORLD_FEATURES.forEach((feat) => {
  const key = (feat.properties?.name ?? '').toString().toLowerCase();
  if (key) {
    FEATURE_BY_NAME.set(key, feat);
  }
});

const COUNTRY_ALIASES: Record<string, string> = {
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

Object.entries(COUNTRY_ALIASES).forEach(([alias, canonical]) => {
  const target = FEATURE_BY_NAME.get(canonical.toLowerCase());
  if (target) {
    FEATURE_BY_NAME.set(alias, target);
  }
});

const REGION_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'XK', 'YE', 'YT', 'ZA', 'ZM', 'ZW'
];

const COUNTRY_CODE_OVERRIDES: Record<string, string> = {
  usa: 'US',
  'united states': 'US',
  'united states of america': 'US',
  uk: 'GB',
  'united kingdom': 'GB',
  'south korea': 'KR',
  'north korea': 'KP',
  russia: 'RU',
  'czech republic': 'CZ',
  laos: 'LA',
  vietnam: 'VN',
  venezuela: 'VE',
  bolivia: 'BO',
  tanzania: 'TZ',
  syria: 'SY',
  iran: 'IR',
  moldova: 'MD',
  palestine: 'PS',
  'palestinian territories': 'PS',
  macedonia: 'MK',
  'north macedonia': 'MK',
  'bosnia and herzegovina': 'BA',
  'saint lucia': 'LC',
  'st lucia': 'LC',
  'st. lucia': 'LC',
  'democratic republic of the congo': 'CD',
  'congo (drc)': 'CD',
  'congo drc': 'CD',
  drc: 'CD',
  'republic of the congo': 'CG',
  'congo republic': 'CG',
  congo: 'CG',
  'dr congo': 'CD',
  ivorycoast: 'CI',
  "cote d'ivoire": 'CI',
  'ivory coast': 'CI',
  swaziland: 'SZ',
  eswatini: 'SZ',
  'the netherlands': 'NL',
  'trinidad and tobago': 'TT'
};

@Component({
  selector: 'app-proxies-per-country-card',
  standalone: true,
  imports: [HlmCardImports, DialogComponent, DashboardChartComponent, FormsModule],
  providers: [DecimalPipe],
  templateUrl: './proxies-per-country-card.component.html',
  styleUrl: './proxies-per-country-card.component.scss'
})
export class ProxiesPerCountryCardComponent implements OnChanges {
  @Input() title = 'Proxies per country';
  @Input() countries: CountryBreakdown[] = [];
  @Input() styleClass = 'dashboard-card country-card';

  viewMode: 'map' | 'countries' = 'map';
  mapChart: DashboardChartDefinition = {marks: [], scales: {x: null, y: null}};
  mapFeatures: CountryMapFeature[] = [];
  maxCountryValue = 1;
  totalValue = 0;
  readonly listLimit = 7;
  showAllCountries = false;
  searchTerm = '';
  private readonly decimalPipe: DecimalPipe;

  constructor(decimalPipe: DecimalPipe) {
    this.decimalPipe = decimalPipe;
  }

  private readonly regionNames = typeof Intl.DisplayNames !== 'undefined'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;
  private readonly regionLookup = this.buildRegionLookup();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['countries']) {
      this.recalculateTotals();
      this.buildMap();
    }
  }

  countryFlag(country: CountryBreakdown): string {
    const code = this.resolveCountryCode(country?.name);
    const emoji = code ? this.toFlagEmoji(code) : undefined;
    return emoji ?? '🌐';
  }

  visibleCountries(): CountryBreakdown[] {
    if (!Array.isArray(this.countries)) {
      return [];
    }
    return this.countries.slice(0, this.listLimit);
  }

  hasMoreCountries(): boolean {
    return (this.countries?.length ?? 0) > this.listLimit;
  }

  filteredCountries(): CountryBreakdown[] {
    const term = this.searchTerm.trim().toLowerCase();
    const entries = this.countries ?? [];
    if (!term) {
      return entries;
    }
    return entries.filter((entry) => (entry.name ?? '').toLowerCase().includes(term));
  }

  setViewMode(mode: 'map' | 'countries'): void {
    this.viewMode = mode;
  }

  countryPercent(country: CountryBreakdown): number {
    const percent = this.resolvePercentage(country);
    if (percent !== undefined) {
      return percent;
    }

    if (this.totalValue <= 0) {
      return 0;
    }

    const value = this.resolveValue(country);
    if (value <= 0) {
      return 0;
    }

    const normalized = (value / this.totalValue) * 100;
    return this.clampPercentage(normalized);
  }

  private buildRegionLookup(): Map<string, string> {
    if (!this.regionNames) {
      return new Map<string, string>();
    }

    const entries: Array<[string, string]> = [];

    for (const code of REGION_CODES) {
      let name: string | undefined;
      try {
        name = this.regionNames.of(code);
      } catch {
        continue;
      }

      if (!name) {
        continue;
      }

      const lower = name.toLowerCase();
      entries.push([lower, code]);

      const normalized = this.normalizeNameKey(name);
      if (normalized && normalized !== lower) {
        entries.push([normalized, code]);
      }
    }

    return new Map(entries);
  }

  private resolveCountryCode(name: string | undefined | null): string | undefined {
    const normalized = (name ?? '').trim();
    if (!normalized) {
      return undefined;
    }

    const lower = normalized.toLowerCase();
    if (lower === 'unknown' || lower === 'others' || lower === 'n/a') {
      return undefined;
    }

    if (/^[a-z]{2}$/i.test(normalized)) {
      return normalized.toUpperCase();
    }

    const override = COUNTRY_CODE_OVERRIDES[lower];
    if (override) {
      return override;
    }

    const lookup = this.regionLookup.get(lower);
    if (lookup) {
      return lookup;
    }

    const compact = this.normalizeNameKey(normalized);
    if (compact) {
      const compactMatch = this.regionLookup.get(compact);
      if (compactMatch) {
        return compactMatch;
      }
    }

    const alias = COUNTRY_ALIASES[lower];
    if (alias) {
      const aliasKey = alias.toLowerCase();
      const aliasMatch = this.regionLookup.get(aliasKey)
        ?? this.regionLookup.get(this.normalizeNameKey(aliasKey));
      if (aliasMatch) {
        return aliasMatch;
      }
    }

    for (const [key, code] of this.regionLookup.entries()) {
      if (key.startsWith(lower) || lower.startsWith(key)) {
        return code;
      }
      if (compact && (key.startsWith(compact) || compact.startsWith(key))) {
        return code;
      }
    }

    return undefined;
  }

  private normalizeNameKey(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/g, '');
  }

  private toFlagEmoji(code: string): string | undefined {
    if (!code || code.length !== 2 || !/^[A-Z]{2}$/i.test(code)) {
      return undefined;
    }

    const upper = code.toUpperCase();
    const base = 0x1f1e6;
    const offset = (char: string) => base + (char.charCodeAt(0) - 65);
    return String.fromCodePoint(offset(upper[0]), offset(upper[1]));
  }

  private buildMap(): void {
    const values = new Map<string, number>();
    let maxValue = 0;

    for (const entry of this.countries ?? []) {
      const featureMatch = this.resolveFeature(entry.name);
      if (!featureMatch) {
        continue;
      }

      const value = this.resolveValue(entry);
      if (value <= 0) {
        continue;
      }

      const key = (featureMatch.properties?.name ?? '').toLowerCase();
      const nextValue = (values.get(key) ?? 0) + value;
      values.set(key, nextValue);
      maxValue = Math.max(maxValue, nextValue);
    }

    this.maxCountryValue = Math.max(maxValue, 1);

    this.mapFeatures = WORLD_FEATURES.map(feature => ({
      ...feature,
      properties: {...feature.properties, value: values.get(feature.properties.name.toLowerCase()) ?? 0},
    }));
    this.mapChart = buildCountryMapChart(this.mapFeatures, this.maxCountryValue, value => this.formatNumber(value));
  }

  private resolveFeature(name: string | undefined | null): CountryFeature | undefined {
    const normalized = (name ?? '').trim();
    if (!normalized || normalized.toLowerCase() === 'unknown' || normalized.toLowerCase() === 'others') {
      return undefined;
    }

    const lower = normalized.toLowerCase();
    const exact = FEATURE_BY_NAME.get(lower);
    if (exact) {
      return exact;
    }

    const alias = COUNTRY_ALIASES[lower];
    if (alias) {
      const mapped = FEATURE_BY_NAME.get(alias.toLowerCase());
      if (mapped) {
        return mapped;
      }
    }

    if (this.regionNames && /^[a-z]{2,3}$/i.test(normalized)) {
      const display = this.regionNames.of(normalized.toUpperCase());
      if (display) {
        const displayKey = display.toLowerCase();
        const displayMatch = FEATURE_BY_NAME.get(displayKey)
          ?? FEATURE_BY_NAME.get((COUNTRY_ALIASES[displayKey] ?? '').toLowerCase());
        if (displayMatch) {
          return displayMatch;
        }
      }
    }

    return WORLD_FEATURES.find((feat) => {
      const key = (feat.properties?.name ?? '').toString().toLowerCase();
      return key === lower || key.startsWith(lower) || lower.startsWith(key);
    });
  }

  private resolveValue(country: CountryBreakdown): number {
    if (typeof country.value === 'number' && !Number.isNaN(country.value)) {
      return country.value;
    }

    if (typeof country.percentage === 'number' && !Number.isNaN(country.percentage)) {
      return country.percentage;
    }

    const parsed = Number.parseFloat(country.percentage?.toString() ?? '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private resolvePercentage(country: CountryBreakdown): number | undefined {
    if (typeof country?.percentage === 'number' && Number.isFinite(country.percentage)) {
      return this.clampPercentage(country.percentage);
    }

    if (typeof country?.percentage === 'string') {
      const parsed = Number.parseFloat(country.percentage.replace(/[^\d.-]/g, ''));
      if (Number.isFinite(parsed)) {
        return this.clampPercentage(parsed);
      }
    }

    return undefined;
  }

  private clampPercentage(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(100, Math.max(0, value));
  }

  private recalculateTotals(): void {
    let sum = 0;

    for (const entry of this.countries ?? []) {
      const value = this.resolveValue(entry);
      if (value > 0) {
        sum += value;
      }
    }

    this.totalValue = sum;
  }

  private formatNumber(value: number): string {
    return this.decimalPipe.transform(value, '1.0-0') ?? '0';
  }

}
