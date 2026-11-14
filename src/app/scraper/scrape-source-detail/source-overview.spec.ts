import {formatCountdown, healthShareCells, scrapeCycle, sharePercent} from './source-overview';

describe('source overview', () => {
  const count = (cells: string[], state: string) => cells.filter(cell => cell === state).length;

  describe('healthShareCells', () => {
    it('keeps one cell for a state that would round to none', () => {
      const cells = healthShareCells(1, 84, 110);
      expect(cells.length).toBe(100);
      expect(count(cells, 'alive')).toBe(1);
      expect(count(cells, 'dead')).toBe(43);
      expect(count(cells, 'unknown')).toBe(56);
      expect(cells[0]).toBe('alive');
      expect(cells[99]).toBe('unknown');
    });

    it('takes the extra cell from the largest share when small states are rounded up', () => {
      const cells = healthShareCells(1, 1, 998);
      expect(cells.length).toBe(100);
      expect(count(cells, 'alive')).toBe(1);
      expect(count(cells, 'dead')).toBe(1);
      expect(count(cells, 'unknown')).toBe(98);
    });

    it('gives a state without proxies no cell', () => {
      const cells = healthShareCells(3, 0, 0);
      expect(count(cells, 'alive')).toBe(100);
    });

    it('fills the grid with unknown cells when no proxies are linked', () => {
      expect(count(healthShareCells(0, 0, 0), 'unknown')).toBe(100);
    });
  });

  describe('sharePercent', () => {
    it('does not round a partial share to 0% or 100%', () => {
      expect(sharePercent(1, 195)).toBe('1%');
      expect(sharePercent(1, 1000)).toBe('<1%');
      expect(sharePercent(999, 1000)).toBe('>99%');
      expect(sharePercent(0, 1000)).toBe('0%');
      expect(sharePercent(1000, 1000)).toBe('100%');
      expect(sharePercent(0, 0)).toBe('');
    });
  });

  describe('scrapeCycle', () => {
    const last = '2026-11-12T17:07:00Z';
    const next = '2026-11-12T22:07:00Z';

    it('reports progress and the time left between two scrapes', () => {
      const cycle = scrapeCycle(last, next, Date.parse('2026-11-12T18:22:00Z'));
      expect(cycle.progress).toBe(25);
      expect(cycle.countdown).toBe('3 h 45 min');
      expect(cycle.due).toBeFalse();
    });

    it('marks a scheduled time in the past as due', () => {
      expect(scrapeCycle(last, next, Date.parse('2026-11-12T22:08:00Z')))
        .toEqual({progress: 100, countdown: null, due: true});
    });

    it('counts down without progress before the first scrape', () => {
      const cycle = scrapeCycle(null, next, Date.parse('2026-11-12T21:37:00Z'));
      expect(cycle.progress).toBe(0);
      expect(cycle.countdown).toBe('30 min');
    });

    it('has nothing to show when no scrape is scheduled', () => {
      expect(scrapeCycle(last, null, Date.now())).toEqual({progress: 0, countdown: null, due: false});
    });
  });

  describe('formatCountdown', () => {
    it('uses the two largest units and rounds up to whole minutes', () => {
      expect(formatCountdown(20_000)).toBe('1 min');
      expect(formatCountdown(45 * 60_000)).toBe('45 min');
      expect(formatCountdown(3 * 3_600_000)).toBe('3 h');
      expect(formatCountdown(26 * 3_600_000 + 10 * 60_000)).toBe('1 d 2 h');
      expect(formatCountdown(48 * 3_600_000)).toBe('2 d');
    });
  });
});
