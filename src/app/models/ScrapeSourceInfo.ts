export interface ScrapeSourceInfo {
  fetch_mode?: 'http' | 'browser';
  last_scraped_at?: string | null;
  last_scrape_status?: string;
  last_scrape_error?: string;
  last_scrape_proxy_count?: number;
  "id": number;
  "url": string;
  "proxy_count": number;
  "alive_count": number;
  "dead_count": number;
  "unknown_count": number;
}
