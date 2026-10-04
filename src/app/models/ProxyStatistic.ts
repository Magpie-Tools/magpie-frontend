export interface ProxyStatistic {
  id: number;
  transport?: string;
  timeout?: number;
  retries?: number;
  config_key?: string;
  current?: boolean;
  alive: boolean;
  attempt: number;
  response_time: number;
  protocol: string;
  anonymity_level: string;
  judge: string;
  created_at: string;
}

