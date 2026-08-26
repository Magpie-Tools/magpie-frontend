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
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
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
