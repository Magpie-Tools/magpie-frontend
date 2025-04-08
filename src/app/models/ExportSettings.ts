import {FormGroup} from '@angular/forms';
import {ProxyInfo} from './ProxyInfo';

export interface ExportSettings {
  proxies: number[]
  filter: boolean
  http: boolean
  https: boolean
  socks4: boolean
  socks5: boolean
  maxRetries: number
  maxTimeout: number
  proxyStatus: 'all' | 'alive' | 'dead'
  outputFormat: string
}

