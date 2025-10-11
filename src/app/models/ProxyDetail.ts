import {ProxyStatistic} from './ProxyStatistic';

export interface ProxyDetail {
  id: number;
  ip: string;
  port: number;
  username: string;
  password: string;
  has_auth: boolean;
  estimated_type: string;
  country: string;
  created_at: string;
  latest_check?: string | null;
  latest_statistic?: ProxyStatistic | null;
}

