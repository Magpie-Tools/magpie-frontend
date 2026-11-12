import {ProxyStatisticHour, ProxyStatisticHours} from '../../models/ProxyStatisticHour';

/** Window lengths offered by the availability switch, in hours. */
export const AVAILABILITY_RANGES = [
  {hours: 24, label: '24h'},
  {hours: 72, label: '3d'},
  {hours: 168, label: '7d'},
] as const;

export type AvailabilityRange = typeof AVAILABILITY_RANGES[number]['hours'];

/**
 * outside: before the window or in the future. empty: in the window without checks.
 * fast/medium/slow: every check passed, shaded by the hour's average against the window.
 * partial: some checks failed. failed: every check failed.
 */
export type AvailabilityCellState = 'outside' | 'empty' | 'fast' | 'medium' | 'slow' | 'partial' | 'failed';

export interface AvailabilityCell {
  hour: number;
  state: AvailabilityCellState;
  current: boolean;
  /** Full description for assistive technology. */
  label: string;
  /** Local time range of the hour, e.g. "Di., 10.11., 07:00–08:00". */
  range: string;
  checks: number;
  failed: number;
  /** Average response time of the hour's successful checks in ms, or null without any. */
  averageResponseTime: number | null;
}

export interface AvailabilityDay {
  key: string;
  label: string;
  cells: AvailabilityCell[];
}

export interface AvailabilitySummary {
  checks: number;
  failed: number;
  /** Share of successful checks, 0–100, or null without checks. */
  successRate: number | null;
  /** Average response time of successful checks in ms, or null without any. */
  averageResponseTime: number | null;
}

interface LocalHour {
  checks: number;
  failed: number;
  responseTotal: number;
}

const HOUR_MS = 60 * 60 * 1000;

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** Totals for the window; the average weights each hour by its successful checks. */
export function summarizeAvailability(hours: readonly ProxyStatisticHour[]): AvailabilitySummary {
  let checks = 0, failed = 0, responseTotal = 0;
  for (const hour of hours) {
    checks += hour.checks;
    failed += hour.failed;
    responseTotal += hour.avg_response_time * (hour.checks - hour.failed);
  }
  const passed = checks - failed;
  return {
    checks,
    failed,
    successRate: checks ? Math.round((passed / checks) * 100) : null,
    averageResponseTime: passed ? Math.round(responseTotal / passed) : null,
  };
}

/**
 * Lays the hourly buckets out as one row per local calendar day that the window touches,
 * with 24 hour cells per row. Buckets are UTC hours; each lands in the local hour it starts in,
 * and buckets that share a local hour (the repeated hour when clocks go back) are merged.
 */
export function buildAvailabilityGrid(data: ProxyStatisticHours, now: Date, locale = 'de-DE'): AvailabilityDay[] {
  const since = new Date(data.since);
  if (Number.isNaN(since.getTime())) return [];

  const byHour = new Map<string, LocalHour>();
  for (const bucket of data.hours) {
    const start = new Date(bucket.hour);
    if (Number.isNaN(start.getTime())) continue;
    const key = `${dayKey(start)}-${start.getHours()}`;
    const entry = byHour.get(key) ?? {checks: 0, failed: 0, responseTotal: 0};
    entry.checks += bucket.checks;
    entry.failed += bucket.failed;
    entry.responseTotal += bucket.avg_response_time * (bucket.checks - bucket.failed);
    byHour.set(key, entry);
  }

  // Shade passing hours by thirds of the window's own averages, so "fast" is relative to this proxy.
  const averages = [...byHour.values()]
    .filter(entry => entry.checks > 0 && entry.failed === 0)
    .map(entry => entry.responseTotal / entry.checks)
    .sort((a, b) => a - b);
  const third = (fraction: number) => averages[Math.floor((averages.length - 1) * fraction)];
  const fastLimit = third(1 / 3), mediumLimit = third(2 / 3);

  const dayLabel = new Intl.DateTimeFormat(locale, {weekday: 'short', day: '2-digit', month: '2-digit'});
  const hourLabel = new Intl.DateTimeFormat(locale, {weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
  const timeLabel = new Intl.DateTimeFormat(locale, {hour: '2-digit', minute: '2-digit'});
  const number = new Intl.NumberFormat(locale);
  const currentHour = new Date(now);
  currentHour.setMinutes(0, 0, 0);

  const days: AvailabilityDay[] = [];
  for (const day = new Date(since.getFullYear(), since.getMonth(), since.getDate()); day.getTime() <= now.getTime(); day.setDate(day.getDate() + 1)) {
    const cells: AvailabilityCell[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
      const end = new Date(start.getTime() + HOUR_MS);
      const range = `${hourLabel.format(start)}–${timeLabel.format(end)}`;
      const current = start.getTime() === currentHour.getTime();
      // A local hour counts as inside when any part of it overlaps the window.
      if (end.getTime() <= since.getTime() || start.getTime() > now.getTime()) {
        cells.push({hour, state: 'outside', current: false, label: range, range, checks: 0, failed: 0, averageResponseTime: null});
        continue;
      }
      const entry = byHour.get(`${dayKey(start)}-${hour}`);
      if (!entry || entry.checks === 0) {
        cells.push({hour, state: 'empty', current, label: `${range} · No checks`, range, checks: 0, failed: 0, averageResponseTime: null});
        continue;
      }
      const passed = entry.checks - entry.failed;
      const average = passed ? Math.round(entry.responseTotal / passed) : 0;
      let state: AvailabilityCellState;
      if (passed === 0) state = 'failed';
      else if (entry.failed > 0) state = 'partial';
      else state = average <= fastLimit ? 'fast' : average <= mediumLimit ? 'medium' : 'slow';
      const checks = `${number.format(entry.checks)} ${entry.checks === 1 ? 'check' : 'checks'}`;
      const failures = entry.failed ? ` · ${number.format(entry.failed)} failed` : '';
      const speed = passed ? ` · avg ${number.format(average)} ms` : '';
      cells.push({
        hour, state, current, label: `${range} · ${checks}${failures}${speed}`, range,
        checks: entry.checks, failed: entry.failed, averageResponseTime: passed ? average : null,
      });
    }
    days.push({key: dayKey(day), label: dayLabel.format(day), cells});
  }
  return days;
}
