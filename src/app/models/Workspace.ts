export type WorkspaceRole = 'owner' | 'admin' | 'operator' | 'viewer';
export type ManagedProxyState = 'active' | 'paused' | 'archived';

export interface WorkspaceCapacity {
  active_routes: number;
  stored_routes: number;
  included_routes: number;
  additional_routes: number;
  overage_routes: number;
  activation_limit: number | null;
  overage_mode: 'disabled' | 'allowed' | 'unlimited';
}

export interface WorkspaceSubscription {
  plan_code: string;
  status: string;
  included_operators: number;
  statistics_retention_days: number;
  minimum_check_interval_seconds: number;
  /** The workspace's own monthly allowance; 0 inherits the instance default. */
  monthly_checks: number;
  monthly_scrapes: number;
  /** No monthly limit; the workspace must choose fixed intervals. */
  unlimited_checks: boolean;
  unlimited_scrapes: boolean;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
}

/** Effective monthly allowances, metered use and the cadence derived from them. */
export interface WorkspaceAllowances {
  /** No monthly limit (own or inherited); monthly_* is then not enforced. */
  unlimited_checks: boolean;
  unlimited_scrapes: boolean;
  /** Unlimited without a fixed interval yet: runs hourly until one is chosen. */
  needs_check_interval: boolean;
  needs_scrape_interval: boolean;
  monthly_checks: number;
  used_checks: number;
  checks_per_cycle: number;
  check_interval_seconds: number;
  checks_exhausted: boolean;
  monthly_scrapes: number;
  used_scrapes: number;
  scrapes_per_cycle: number;
  scrape_interval_seconds: number;
  scrapes_exhausted: boolean;
  /** The workspace's chosen intervals; 0 spreads the allowance automatically. */
  requested_check_interval_seconds: number;
  requested_scrape_interval_seconds: number;
  minimum_check_interval_seconds: number;
  minimum_scrape_interval_seconds: number;
  projected_monthly_checks: number;
  checks_run_out_at?: string;
  projected_monthly_scrapes: number;
  scrapes_run_out_at?: string;
  inherits_checks: boolean;
  inherits_scrapes: boolean;
  period_start: string;
  period_end: string;
  computed_at?: string;
}

export interface WorkspaceCadenceUpdateRequest {
  check_interval_seconds: number;
  scrape_interval_seconds: number;
}

export interface WorkspaceCadenceUpdateResponse extends WorkspaceCadenceUpdateRequest {
  warnings: string[];
}

export interface WorkspaceAllowanceUpdateRequest {
  monthly_checks: number;
  monthly_scrapes: number;
  unlimited_checks: boolean;
  unlimited_scrapes: boolean;
}

export interface Workspace {
  id: number;
  name: string;
  personal: boolean;
  role: WorkspaceRole;
  billing_admin: boolean;
  is_default: boolean;
  capacity: WorkspaceCapacity;
  subscription: WorkspaceSubscription;
  allowances: WorkspaceAllowances;
  created_at: string;
}

export interface WorkspaceMember {
  user_id: number;
  email: string;
  role: WorkspaceRole;
  billing_admin: boolean;
  joined_at: string;
}

export interface WorkspaceMemberWriteRequest {
  role: WorkspaceRole;
  billing_admin: boolean;
}

export type WorkspaceInvitationNotificationStatus = 'not_configured' | 'queued' | 'failed';

export interface WorkspaceInvitation {
  id: number;
  workspace_id: number;
  workspace_name: string;
  invitee_user_id: number;
  invitee_email: string;
  inviter_user_id?: number;
  inviter_email: string;
  role: Exclude<WorkspaceRole, 'owner'>;
  billing_admin: boolean;
  notification_status: WorkspaceInvitationNotificationStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceInvitationWriteRequest {
  role: Exclude<WorkspaceRole, 'owner'>;
  billing_admin: boolean;
}

export interface WorkspaceInvitationCreateRequest extends WorkspaceInvitationWriteRequest {
  email: string;
}

export interface WorkspaceInvitationResponse {
  invitation: WorkspaceInvitation;
  warning?: string;
}

export interface WorkspaceInvitationAcceptance {
  workspace_id: number;
  workspace_name: string;
}
