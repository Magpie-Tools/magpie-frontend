export type AlertMetric = 'usable_routes' | 'success_rate' | 'latency_ms';
export type AlertChannel = 'email' | 'slack' | 'discord' | 'webhook';
export type AlertMentionMode = 'none' | 'here' | 'everyone' | 'role' | 'channel' | 'user_group';
export interface AlertRotator {
  id: number;
  name: string;
  protocol: string;
}
export interface AlertRuleWrite {
  name: string;
  rotator_id: number | null;
  metric: AlertMetric;
  threshold: number;
  enabled: boolean;
  destination_ids: number[];
}
export interface AlertRule extends AlertRuleWrite {
  id: number;
  revision: number;
  status: string;
  unknown_reason: string;
  last_value: number | null;
  sample_count: number;
  last_evaluated_at: string | null;
  breach_since: string | null;
  recovery_since: string | null;
  active_incident_id: number | null;
}
export interface AlertDestination {
  id: number;
  name: string;
  kind: AlertChannel;
  enabled: boolean;
  target_configured: boolean;
  signing_configured: boolean;
  mention_mode: AlertMentionMode;
  mention_id: string;
}
export interface AlertDestinationWrite {
  name: string;
  kind: AlertChannel;
  enabled: boolean;
  target?: string;
  signing_secret?: string;
  mention_mode?: AlertMentionMode;
  mention_id?: string;
}
export interface AlertIncident {
  id: number;
  rule_id: number;
  rule_revision: number;
  rule_name: string;
  scope_name: string;
  metric: AlertMetric;
  threshold: number;
  opening_value: number;
  closing_value: number | null;
  opened_at: string;
  closed_at: string | null;
  close_reason: string;
}
export interface AlertDelivery {
  id: number;
  incident_id: number;
  destination_id: number;
  destination_name: string;
  kind: AlertChannel;
  event: 'opened' | 'recovered';
  status: string;
  attempts: number;
  last_error: string;
  sent_at: string | null;
}
export interface AlertsPage {
  rules: AlertRule[];
  destinations: AlertDestination[];
  incidents: AlertIncident[];
  deliveries: AlertDelivery[];
  next_cursor: number;
}
