import {formatHostPort, isIPAddress} from './proxy-address';

describe('formatHostPort', () => {
  it('formats IPv4 and IPv6 addresses', () => {
    expect(formatHostPort('192.0.2.1', 8080)).toBe('192.0.2.1:8080');
    expect(formatHostPort('2001:db8::1', 8080)).toBe('[2001:db8::1]:8080');
    expect(formatHostPort('[2001:db8::1]', 8080)).toBe('[2001:db8::1]:8080');
  });

  it('returns only the port when no host is available', () => {
    expect(formatHostPort('', 8080)).toBe('8080');
  });

  it('formats provider hostnames without brackets', () => {
    expect(formatHostPort('gateway.provider.example', 3128)).toBe('gateway.provider.example:3128');
  });
});

describe('isIPAddress', () => {
  it('distinguishes literal IP addresses from provider hostnames', () => {
    expect(isIPAddress('192.0.2.1')).toBeTrue();
    expect(isIPAddress('2001:db8::1')).toBeTrue();
    expect(isIPAddress('[2001:db8::1]')).toBeTrue();
    expect(isIPAddress('gateway.provider.example')).toBeFalse();
  });
});
