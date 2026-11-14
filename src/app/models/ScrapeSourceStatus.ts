export function scrapeStatusLabel(status?: string): string {
  switch (status) {
    case 'success': return 'Scraped';
    case 'empty': return 'No proxies found';
    case 'error': return 'Scrape failed';
    case 'blocked': return 'Blocked by robots.txt';
    default: return 'Waiting for scrape';
  }
}

/** Colour of a scrape result: success, a partial outcome that needs a look, a failure, or no result yet. */
export function scrapeStatusTone(status?: string): 'good' | 'warn' | 'bad' | 'neutral' {
  switch (status) {
    case 'success': return 'good';
    case 'empty':
    case 'blocked': return 'warn';
    case 'error': return 'bad';
    default: return 'neutral';
  }
}
