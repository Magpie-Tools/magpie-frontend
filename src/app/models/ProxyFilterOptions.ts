import {ProxyTag} from './ProxyTag';

export interface ProxyFilterOptions {
  countries: string[];
  types: string[];
  anonymityLevels: string[];
  tags?: ProxyTag[];
}
