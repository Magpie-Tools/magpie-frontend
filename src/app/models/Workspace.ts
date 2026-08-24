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

export interface WorkspaceMemberCreateRequest extends WorkspaceMemberWriteRequest {
  email: string;
}
