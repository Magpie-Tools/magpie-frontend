import {ProxyStatistic} from './ProxyStatistic';
import {ProxyReputationBreakdown} from './ProxyReputation';
import {ProxyTag} from './ProxyTag';
import {ManagedProxyState} from './Workspace';

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
  reputation?: ProxyReputationBreakdown | null;
  tags?: ProxyTag[];
  state?: ManagedProxyState;
  pause_reason?: string;
}
