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

export function isIPAddress(host: string | null | undefined): boolean {
  let normalizedHost = (host ?? '').toString().trim();
  if (normalizedHost.startsWith('[') && normalizedHost.endsWith(']')) {
    normalizedHost = normalizedHost.slice(1, -1);
  }
  if (normalizedHost.includes(':')) {
    return true;
  }

  const octets = normalizedHost.split('.');
  return octets.length === 4 && octets.every(octet => {
    if (!/^\d+$/.test(octet)) {
      return false;
    }
    const value = Number(octet);
    return value >= 0 && value <= 255;
  });
}
