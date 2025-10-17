export interface RotatingProxy {
  id: number;
  name: string;
  protocol: string;
  alive_proxy_count: number;
  listen_port: number;
  auth_required: boolean;
  auth_username?: string | null;
  last_rotation_at?: string | null;
  last_served_proxy?: string | null;
  created_at: string;
}

export interface CreateRotatingProxy {
  name: string;
  protocol: string;
  listen_port: number;
  auth_required: boolean;
  auth_username?: string | null;
  auth_password?: string | null;
}

export interface RotatingProxyNext {
  proxy_id: number;
  ip: string;
  port: number;
  username?: string | null;
  password?: string | null;
  has_auth: boolean;
  protocol: string;
}
