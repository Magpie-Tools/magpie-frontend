export interface ProxyInfo {
  "id": number;
  "ip": string;
  "port": number;
  "estimated_type": string;
  "response_time": number;
  "country": string;
  "anonymity_level": string;
  "alive": boolean;
  "latest_check": Date;
}

export interface ProxyPage {
  "proxies": ProxyInfo[];
  "total": number;
}
