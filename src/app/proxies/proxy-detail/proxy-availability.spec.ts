import {ProxyStatisticHour} from '../../models/ProxyStatisticHour';
import {buildAvailabilityGrid, summarizeAvailability} from './proxy-availability';

// Local times keep the grid assertions independent of the machine's time zone.
const local = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute);
const bucket = (start: Date, checks: number, failed: number, avg: number): ProxyStatisticHour => ({
  hour: start.toISOString(), checks, failed, avg_response_time: avg,
});

describe('Proxy availability', () => {
  it('summarizes success and weights the average by successful checks', () => {
    const summary = summarizeAvailability([
      bucket(local(12, 9), 4, 0, 1000),
      bucket(local(12, 10), 4, 2, 4000),
      bucket(local(12, 11), 2, 2, 0),
    ]);
    expect(summary).toEqual({checks: 10, failed: 4, successRate: 60, averageResponseTime: 2000});
    expect(summarizeAvailability([])).toEqual({checks: 0, failed: 0, successRate: null, averageResponseTime: null});
  });

  it('lays out one row per touched day with outside, empty and current hours', () => {
    const since = local(11, 20);
    const now = local(12, 3, 30);
    const grid = buildAvailabilityGrid({since: since.toISOString(), hours: [bucket(local(11, 21), 3, 0, 500)]}, now);

    expect(grid.length).toBe(2);
    expect(grid.every(day => day.cells.length === 24)).toBeTrue();
    expect(grid[0].cells[19].state).toBe('outside');
    expect(grid[0].cells[20].state).toBe('empty');
    expect(grid[0].cells[21].state).toBe('fast');
    expect(grid[0].cells[21].label).toContain('3 checks');
    expect(grid[1].cells[3].current).toBeTrue();
    expect(grid[1].cells[3].state).toBe('empty');
    expect(grid[1].cells[4].state).toBe('outside');
  });

  it('marks partial and full failures and shades passing hours by thirds', () => {
    const since = local(12, 0);
    const grid = buildAvailabilityGrid({since: since.toISOString(), hours: [
      bucket(local(12, 0), 2, 0, 100),
      bucket(local(12, 1), 2, 0, 500),
      bucket(local(12, 2), 2, 0, 900),
      bucket(local(12, 3), 4, 1, 300),
      bucket(local(12, 4), 3, 3, 0),
    ]}, local(12, 6));
    const states = grid[0].cells.slice(0, 5).map(cell => cell.state);
    expect(states).toEqual(['fast', 'medium', 'slow', 'partial', 'failed']);
    expect(grid[0].cells[3].label).toContain('1 failed');
    expect(grid[0].cells[4].label).not.toContain('avg');
  });

  it('returns no rows for an invalid window', () => {
    expect(buildAvailabilityGrid({since: '', hours: []}, new Date())).toEqual([]);
  });
});
