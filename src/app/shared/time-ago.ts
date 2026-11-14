/**
 * Elapsed time since a timestamp in the app's compact units, e.g. "just now", "4 min ago", "3 h ago",
 * "2 d ago". Timestamps slightly in the future (clock skew) read as "just now"; null when unparsable.
 */
export function formatTimeAgo(value: string | null | undefined, now: number): string | null {
  const at = value ? Date.parse(value) : NaN;
  if (Number.isNaN(at)) {
    return null;
  }

  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  return `${Math.floor(hours / 24)} d ago`;
}
