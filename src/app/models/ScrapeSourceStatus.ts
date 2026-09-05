export function scrapeStatusLabel(status?: string): string {
  switch (status) {
    case 'success': return 'Scraped';
    case 'empty': return 'No proxies found';
    case 'error': return 'Scrape failed';
    case 'blocked': return 'Blocked by robots.txt';
    default: return 'Waiting for scrape';
  }
}
