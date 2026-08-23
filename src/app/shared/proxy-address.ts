export function formatHostPort(host: string | null | undefined, port: number | string): string {
  let normalizedHost = (host ?? '').toString().trim();
  const normalizedPort = `${port}`.trim();
  if (!normalizedHost) {
    return normalizedPort;
  }

  if (normalizedHost.startsWith('[') && normalizedHost.endsWith(']')) {
    normalizedHost = normalizedHost.slice(1, -1);
  }

  if (normalizedHost.includes(':')) {
    return `[${normalizedHost}]:${normalizedPort}`;
  }
  return `${normalizedHost}:${normalizedPort}`;
}
