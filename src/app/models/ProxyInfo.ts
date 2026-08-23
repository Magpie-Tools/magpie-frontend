import {ProxyReputationSummary} from './ProxyReputation';
import {ProxyTag} from './ProxyTag';

export interface ProxyHealthSummary {
  "overall"?: number;
  "http"?: number;
  "https"?: number;
  "socks4"?: number;
  "socks5"?: number;
}

export interface ProxyInfo {
  "id": number;
  "ip": string;
  "port": number;
  "estimated_type": string;
  "response_time": number;
  "country": string;
  "anonymity_level": string;
  "alive": boolean;
  "health"?: ProxyHealthSummary | null;
  "latest_check": Date;
  "reputation"?: ProxyReputationSummary | null;
  "tags"?: ProxyTag[];
}

export interface ProxyPage {
  "proxies": ProxyInfo[];
  "total": number;
}
