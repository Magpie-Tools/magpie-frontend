export interface GlobalSettings {
  protocols: {
    http: boolean;
    https: boolean;
    socks4: boolean;
    socks5: boolean;
  };

  checker: {
    dynamic_threads: boolean;
    threads: number;
    max_threads: number;
    save_responses: boolean;
    retries: number;
    timeout: number;
    /** Monthly checks of every workspace without its own allowance. */
    monthly_checks_per_workspace: number;
    /** No default limit; inheriting workspaces must choose a fixed interval. */
    unlimited_monthly_checks: boolean;
    judges_threads: number;
    judges_timeout: number;
    judges: {
      url: string;
      regex: string;
    }[];
    judge_timer: {
      days: number;
      hours: number;
      minutes: number;
      seconds: number;
    };
    use_https_for_socks: boolean;
    ip_lookup: string;
    standard_header: string[];
    proxy_header: string[];
  };

  scraper: {
    dynamic_threads: boolean;
    threads: number;
    max_threads: number;
    retries: number;
    timeout: number;

    /** Monthly scrapes of every workspace without its own allowance. */
    monthly_scrapes_per_workspace: number;
    /** No default limit; inheriting workspaces must choose a fixed interval. */
    unlimited_monthly_scrapes: boolean;
    respect_robots_txt: boolean;

    scrape_sites: string[];
  };

  proxy_limits: {
    enabled: boolean;
    max_per_user: number;
    exclude_admins: boolean;
  };

  plugins: {
    ipgeolocation?: IPGeolocationPluginSettings;
    geolite: {
      enabled: boolean;
      api_key: string;
      auto_update: boolean;
      update_timer: {
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
      };
      last_updated_at?: string | null;
    };
    abuseipdb: {
      enabled: boolean;
      api_key: string;
      max_age_in_days: number;
      daily_limit: number;
      daily_remaining: number;
      daily_reset_at?: string | null;
      last_checked_at?: string | null;
      last_error?: string | null;
    };
  };

  blacklist_timer: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };

  blacklist_sources: string[];
  website_blacklist: string[];
}

export interface IPGeolocationPluginSettings {
  enabled: boolean;
  api_key: string;
  include_security: boolean;
  daily_credit_limit: number;
  cache_hours: number;
}

export interface IPGeolocationStatus {
  used_credits: number;
  daily_credit_limit: number;
  reset_at: string;
  next_request_at?: string | null;
  last_checked_at?: string | null;
  last_error: string;
}
