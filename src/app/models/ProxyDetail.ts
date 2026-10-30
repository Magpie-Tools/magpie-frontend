import {ProxyStatistic} from './ProxyStatistic';
import {ProxyReputationBreakdown} from './ProxyReputation';
import {ProxyTag} from './ProxyTag';
import {ManagedProxyState} from './Workspace';

export interface ProxyDetail {
  id: number;
  alive?: boolean | null;
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
  ipgeolocation?: {
    checked_at: string; expires_at: string; fresh: boolean;
    result: {
      ip: string;
      company: {name: string; type: string};
      network: {connection_type: string};
      asn: {as_number: string; organization: string; type: string};
      security?: {is_proxy?: boolean | null; is_vpn?: boolean | null; is_tor?: boolean | null; is_residential_proxy?: boolean | null;
        proxy_confidence_score?: number | null; proxy_last_seen: string; proxy_provider_names: string[]};
    };
  };
}
