/** Formats a cadence in seconds, such as "every 43 minutes" or "every 4.8 hours". */
export function formatApproximateDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'not scheduled';
  }
  if (seconds < 3600) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return `every ${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  if (seconds < 48 * 3600) {
    const hours = Math.round((seconds / 3600) * 10) / 10;
    return `every ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const days = Math.round((seconds / 86400) * 10) / 10;
  return `every ${days} days`;
}
