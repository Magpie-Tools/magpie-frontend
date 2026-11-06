import {HlmCardImports} from '@spartan-ng/helm/card';
import {DialogComponent} from '../../../shared/ui/dialog.component';
import {ChartComponent} from '../../../shared/ui/chart.component';
import type {AppChartDefinition} from '../../../shared/ui/chart.component';
import {buildCountryMapChart, CountryMapFeature, CountryMapFrame} from './country-map-chart';
import {Component, computed, DestroyRef, ElementRef, inject, Input, OnChanges, signal, SimpleChanges, viewChild} from '@angular/core';
import {DecimalPipe} from '@angular/common';
import {FormsModule} from '@angular/forms';

import {COUNTRY_ALIASES, WORLD_FEATURES, resolveWorldCountry} from '../../../shared/world-map';
import {constrainMapView, INITIAL_MAP_VIEW, MAP_MAX_ZOOM, mapPanKeyStep, MapView, mapWheelZoomFactor, mapZoomKeyFactor, svgMapPoint, zoomMapView} from '../../../shared/map-navigation';

interface CountryBreakdown {
  name: string;
  percentage: string | number;
  value?: number;
  color?: string;
}

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
  imports: [HlmCardImports, DialogComponent, ChartComponent, FormsModule],
  providers: [DecimalPipe],
  templateUrl: './proxies-per-country-card.component.html',
  styleUrl: './proxies-per-country-card.component.scss'
})
export class ProxiesPerCountryCardComponent implements OnChanges {
  @Input() title = 'Proxies per country';
  @Input() countries: CountryBreakdown[] = [];
  @Input() styleClass = 'dashboard-card country-card';

  viewMode: 'map' | 'countries' = 'map';
  mapChart: AppChartDefinition = {marks: [], scales: {x: null, y: null}};
  mapFeatures: CountryMapFeature[] = [];
  maxCountryValue = 1;
  totalValue = 0;
  readonly listLimit = 7;
  showAllCountries = false;
  searchTerm = '';
  readonly mapView = signal<MapView>(INITIAL_MAP_VIEW);
  readonly isMapDragging = signal(false);
  readonly canZoomOut = computed(() => this.mapView().zoom > 1 + 1e-6);
  readonly canZoomIn = computed(() => this.mapView().zoom < MAP_MAX_ZOOM - 1e-6);
  readonly hasChangedMapView = computed(() => this.mapView().zoom !== 1 || this.mapView().pan.some(value => value !== 0));
  private readonly mapFrame = viewChild<ElementRef<HTMLElement>>('mapFrame');
  private mapLayout?: CountryMapFrame;
  private mapDrag?: {pointerId: number; host: HTMLElement; start: [number, number]; pan: [number, number]};
  private readonly decimalPipe: DecimalPipe;

  constructor(decimalPipe: DecimalPipe) {
    this.decimalPipe = decimalPipe;
    inject(DestroyRef).onDestroy(() => this.stopMapDrag());
  }

  private readonly regionNames = typeof Intl.DisplayNames !== 'undefined'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;
  private readonly regionLookup = this.buildRegionLookup();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['countries']) {
      if (!this.countries.length) this.stopMapDrag();
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
    this.stopMapDrag();
    this.refreshMapChart();
    this.viewMode = mode;
  }

  startMapPan(event: PointerEvent): void {
    if (this.mapDrag || event.button !== 0 || !event.isPrimary || (event.target as Element).closest('button')) return;
    const point = this.mapPoint(event);
    const host = this.mapFrame()?.nativeElement;
    if (!point || !host || !this.mapLayout) return;
    event.preventDefault();
    host.focus({preventScroll: true});
    this.mapDrag = {pointerId: event.pointerId, host, start: point, pan: constrainMapView(this.mapView(), this.mapLayout).pan};
    host.setPointerCapture(event.pointerId);
    this.isMapDragging.set(true);
    this.refreshMapChart();
  }

  moveMapPan(event: PointerEvent): void {
    if (!this.mapDrag || event.pointerId !== this.mapDrag.pointerId) return;
    const point = this.mapPoint(event);
    if (!point) return;
    this.setMapView({zoom: this.mapView().zoom, pan: [
      this.mapDrag.pan[0] + point[0] - this.mapDrag.start[0],
      this.mapDrag.pan[1] + point[1] - this.mapDrag.start[1],
    ]});
  }

  endMapPan(event: PointerEvent): void {
    if (!this.mapDrag || event.pointerId !== this.mapDrag.pointerId) return;
    if (event.type === 'pointerup') this.moveMapPan(event);
    this.stopMapDrag();
    this.refreshMapChart();
  }

  onMapWheel(event: WheelEvent): void {
    if (!event.deltaY || (event.target as Element).closest('button')) return;
    const point = this.mapPoint(event);
    if (!point || !this.mapLayout) return;
    event.preventDefault();
    event.stopPropagation();
    this.zoomMapBy(mapWheelZoomFactor(event, this.mapLayout.plotHeight), point);
  }

  onMapKeyDown(event: KeyboardEvent): void {
    if ((event.target as Element).closest('button')) return;
    const factor = mapZoomKeyFactor(event);
    const step = mapPanKeyStep(event.key);
    if (event.key === 'Home') {
      event.preventDefault();
      this.resetMapView();
    } else if (factor !== undefined) {
      event.preventDefault();
      this.zoomMapBy(factor);
    } else if (step && this.mapLayout) {
      event.preventDefault();
      const view = this.mapView();
      this.setMapView({zoom: view.zoom, pan: [view.pan[0] + step[0] / this.mapLayout.plotWidth, view.pan[1] + step[1] / this.mapLayout.plotHeight]});
    }
  }

  zoomMapBy(factor: number, anchor?: [number, number]): void {
    if (!this.mapLayout) return;
    const view = this.mapView();
    const next = zoomMapView(view, factor, anchor ?? [0.5, 0.5], 1);
    if (next === view) return;
    this.stopMapDrag();
    this.setMapView(next);
    if (!anchor) this.mapFrame()?.nativeElement.focus({preventScroll: true});
  }

  resetMapView(): void {
    this.stopMapDrag();
    this.setMapView(INITIAL_MAP_VIEW);
    this.mapFrame()?.nativeElement.focus({preventScroll: true});
  }

  private setMapView(view: MapView): void {
    this.mapView.set(this.mapLayout ? constrainMapView(view, this.mapLayout) : view);
    this.refreshMapChart();
  }

  private mapPoint(event: MouseEvent): [number, number] | undefined {
    const svg = this.mapFrame()?.nativeElement.querySelector<SVGSVGElement>('svg');
    if (!svg || !this.mapLayout) return undefined;
    const point = svgMapPoint(svg, event);
    return [(point.x - this.mapLayout.x) / this.mapLayout.plotWidth, (point.y - this.mapLayout.y) / this.mapLayout.plotHeight];
  }

  private stopMapDrag(): void {
    const drag = this.mapDrag;
    this.mapDrag = undefined;
    this.isMapDragging.set(false);
    if (drag?.host.hasPointerCapture(drag.pointerId)) drag.host.releasePointerCapture(drag.pointerId);
  }

  private refreshMapChart(): void {
    this.mapChart = buildCountryMapChart(this.mapFeatures, this.maxCountryValue, value => this.formatNumber(value), {
      view: this.mapView(), dragging: this.isMapDragging(), onFrame: frame => { this.mapLayout = frame; },
    });
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
      const featureMatch = resolveWorldCountry(entry.name);
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
    this.refreshMapChart();
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
