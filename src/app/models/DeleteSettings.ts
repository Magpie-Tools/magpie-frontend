export interface DeleteSettings {
  proxies: number[];
  filter: boolean;
  http: boolean;
  https: boolean;
  socks4: boolean;
  socks5: boolean;
  maxRetries: number;
  maxTimeout: number;
  proxyStatus: 'all' | 'alive' | 'dead';
  scope: 'all' | 'selected';
}

