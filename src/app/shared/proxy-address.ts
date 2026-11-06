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

/**
 * Splits an address into segments ending after ".", ":", "-" or "/", so templates can add <wbr>
 * and long hostnames wrap at readable points instead of mid-word.
 */
export function addressBreakParts(value: string): string[] {
  return value.match(/[^.:\-/]*[.:\-/]?/g)?.filter(part => part.length > 0) ?? [value];
}

/** Splits "host:port" (including "[ipv6]:port") into host and port. */
export function splitHostPort(value: string): {host: string; port: string} {
  const index = value.lastIndexOf(':');
  if (index <= 0 || value.endsWith(']') || !/^\d+$/.test(value.slice(index + 1))) return {host: value, port: ''};
  return {host: value.slice(0, index), port: value.slice(index + 1)};
}
