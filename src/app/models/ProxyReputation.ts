export interface ProxyReputation {
  kind: string;
  score: number;
  label: string;
  signals?: Record<string, unknown>;
}

export interface ProxyReputationBreakdown {
  overall?: ProxyReputation | null;
  protocols?: Record<string, ProxyReputation | null> | null;
}

