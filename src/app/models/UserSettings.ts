export type CheckerProtocol = 'http' | 'https' | 'socks4' | 'socks5';
export interface CheckerProfileSettings { protocols: CheckerProtocol[]; transport: string; timeout: number; retries: number; }
export interface TagCheckerRule { tag_id: number; mode: 'replace' | 'add' | 'remove'; protocols: CheckerProtocol[]; transport?: string; timeout?: number; retries?: number; }
export interface CheckerSettings { defaults: CheckerProfileSettings; rules: TagCheckerRule[]; }

export type FailureAction = 'pause' | 'delete';

export interface UserSettings {
  checker_settings?: CheckerSettings;
  http_protocol:     boolean
  https_protocol:    boolean
  socks4_protocol:   boolean
  socks5_protocol:   boolean
  timeout:          number
  retries:          number
  UseHttpsForSocks: boolean
  transport_protocol: string
  auto_remove_failing_proxies: boolean
  auto_remove_failure_threshold: number
  failure_action: FailureAction

  judges: Array<{
    url: string
    regex: string
  }>

  scraping_sources: string[]
  proxy_list_columns?: string[]
  scrape_source_proxy_columns?: string[]
  scrape_source_list_columns?: string[]
}
