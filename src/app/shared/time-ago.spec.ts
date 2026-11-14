import {formatTimeAgo} from './time-ago';

describe('formatTimeAgo', () => {
  const now = Date.parse('2026-11-14T10:00:00Z');

  it('uses the largest whole unit that has passed', () => {
    expect(formatTimeAgo('2026-11-14T09:59:30Z', now)).toBe('just now');
    expect(formatTimeAgo('2026-11-14T09:56:00Z', now)).toBe('4 min ago');
    expect(formatTimeAgo('2026-11-14T09:00:01Z', now)).toBe('59 min ago');
    expect(formatTimeAgo('2026-11-14T07:00:00Z', now)).toBe('3 h ago');
    expect(formatTimeAgo('2026-11-12T09:00:00Z', now)).toBe('2 d ago');
  });

  it('reads future timestamps as just now and rejects missing values', () => {
    expect(formatTimeAgo('2026-11-14T10:02:00Z', now)).toBe('just now');
    expect(formatTimeAgo(null, now)).toBeNull();
    expect(formatTimeAgo('not a date', now)).toBeNull();
  });
});
