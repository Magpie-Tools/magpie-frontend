export function normalizeNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.floor(parsed));
}

/** Formats a number on the given locale with a fixed number of decimals, e.g. "97,5". */
export function formatDecimal(value: number, locale: string, digits = 1): string {
  return new Intl.NumberFormat(locale, {minimumFractionDigits: digits, maximumFractionDigits: digits}).format(value);
}

/** Formats a 0–100 value as a percentage on the given locale with one decimal, e.g. "97,5%". */
export function formatPercent(value: number, locale: string, digits = 1): string {
  return `${formatDecimal(value, locale, digits)}%`;
}
