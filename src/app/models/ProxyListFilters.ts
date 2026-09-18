import {ManagedProxyState} from './Workspace';

export interface ProxyListFilters {
  states?: ManagedProxyState[];
  status?: 'alive' | 'dead';
  protocols?: string[];
  minHealthOverall?: number;
  minHealthHttp?: number;
  minHealthHttps?: number;
  minHealthSocks4?: number;
  minHealthSocks5?: number;
  countries?: string[];
  types?: string[];
  anonymityLevels?: string[];
  maxTimeout?: number;
  maxRetries?: number;
  reputationLabels?: string[];
  tagIds?: number[];
}
