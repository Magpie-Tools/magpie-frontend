export type HealthShareState = 'alive' | 'dead' | 'unknown';

/** Cells in the proxy health grid; each one stands for an equal share of the linked proxies. */
export const HEALTH_SHARE_CELLS = 100;

/**
 * Splits the grid between alive, dead, and unknown proxies in that order. Shares are rounded by
 * largest remainder so the cells always add up, and a state with at least one proxy keeps one
 * cell so that a single alive proxy among thousands stays visible.
 */
export function healthShareCells(
  alive: number,
  dead: number,
  unknown: number,
  cells = HEALTH_SHARE_CELLS,
): HealthShareState[] {
  const states: HealthShareState[] = ['alive', 'dead', 'unknown'];
  const counts = [alive, dead, unknown].map(count => Math.max(0, count || 0));
  const total = counts[0] + counts[1] + counts[2];
  if (total === 0) {
    return Array<HealthShareState>(cells).fill('unknown');
  }

  const exact = counts.map(count => (count / total) * cells);
  const allocated = exact.map((share, index) => (counts[index] > 0 ? Math.max(1, Math.floor(share)) : 0));
  let missing = cells - (allocated[0] + allocated[1] + allocated[2]);
  while (missing !== 0) {
    const step = missing > 0 ? 1 : -1;
    let pick = -1;
    for (let index = 0; index < allocated.length; index++) {
      // Only states with proxies can grow, and no state gives up its last cell.
      if (counts[index] === 0 || (step < 0 && allocated[index] <= 1)) {
        continue;
      }
      if (pick < 0 || step * (exact[index] - allocated[index]) > step * (exact[pick] - allocated[pick])) {
        pick = index;
      }
    }
    if (pick < 0) {
      break;
    }
    allocated[pick] += step;
    missing -= step;
  }

  return states.flatMap((state, index) => Array<HealthShareState>(allocated[index]).fill(state));
}

/** Share of the total as a whole percent; never rounds a partial share to 0% or 100%. */
export function sharePercent(count: number, total: number): string {
  if (total <= 0) {
    return '';
  }
  const percent = Math.round((count / total) * 100);
  if (percent === 0 && count > 0) {
    return '<1%';
  }
  if (percent === 100 && count < total) {
    return '>99%';
  }
  return `${percent}%`;
}

export interface ScrapeCycle {
  /** How far the source is between its last and next scrape, 0 to 100. */
  progress: number;
  /** Time left until the next scrape, e.g. "3 h 45 min"; null when none is scheduled or it is due. */
  countdown: string | null;
  /** The scheduled time has passed and the scrape has not been recorded yet. */
  due: boolean;
}

export function scrapeCycle(
  lastScrapedAt: string | null | undefined,
  nextScrapeAt: string | null | undefined,
  now: number,
): ScrapeCycle {
  const next = nextScrapeAt ? Date.parse(nextScrapeAt) : NaN;
  if (Number.isNaN(next)) {
    return {progress: 0, countdown: null, due: false};
  }
  if (next <= now) {
    return {progress: 100, countdown: null, due: true};
  }

  const last = lastScrapedAt ? Date.parse(lastScrapedAt) : NaN;
  const progress = Number.isNaN(last) || last >= next
    ? 0
    : Math.min(100, Math.max(0, ((now - last) / (next - last)) * 100));
  return {progress, countdown: formatCountdown(next - now), due: false};
}

/** Rounds up to whole minutes, so a countdown never reads "0 min" before the scrape is due. */
export function formatCountdown(milliseconds: number): string {
  const totalMinutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }
  return `${minutes} min`;
}
