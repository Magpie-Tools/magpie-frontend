export interface TopbarBreadcrumb {
  label: string;
  routerLink?: string;
}

/**
 * Breadcrumbs use the same names as the sidebar. Group labels such as Checker
 * and Admin are not pages, so they are never links.
 */
const PAGE_BREADCRUMBS: Readonly<Record<string, readonly TopbarBreadcrumb[]>> = {
  '': [{label: 'Dashboard'}],
  'dashboard': [{label: 'Dashboard'}],
  'proxies': [{label: 'Proxies'}],
  'scraper': [{label: 'Scrape sources'}],
  'rotating': [{label: 'Rotating proxies'}],
  'alerts': [{label: 'Alerts'}],
  'checker/settings': [{label: 'Checker'}, {label: 'Settings'}],
  'checker/judges': [{label: 'Checker'}, {label: 'Judges'}],
  'global/checker': [{label: 'Admin'}, {label: 'Global checker'}],
  'global/scraper': [{label: 'Admin'}, {label: 'Global scraper'}],
  'global/blacklist': [{label: 'Admin'}, {label: 'Global blacklist'}],
  'plugins': [{label: 'Admin'}, {label: 'Plugins'}],
  'plugins/geolite': [{label: 'Admin'}, {label: 'Plugins', routerLink: '/plugins'}, {label: 'GeoLite'}],
  'plugins/abuseipdb': [{label: 'Admin'}, {label: 'Plugins', routerLink: '/plugins'}, {label: 'AbuseIPDB'}],
  'plugins/ipgeolocation': [{label: 'Admin'}, {label: 'Plugins', routerLink: '/plugins'}, {label: 'IPGeolocation.io'}],
  'workspace': [{label: 'Workspace'}],
  'invitations': [{label: 'Workspace invitations'}],
  'account': [{label: 'Account'}],
  'notifications': [{label: 'Releases'}],
};

const DETAIL_BREADCRUMBS: Readonly<Record<string, {parent: TopbarBreadcrumb; fallback: string}>> = {
  proxies: {parent: {label: 'Proxies', routerLink: '/proxies'}, fallback: 'Proxy details'},
  scraper: {parent: {label: 'Scrape sources', routerLink: '/scraper'}, fallback: 'Source details'},
};

/**
 * Builds breadcrumbs for a router URL. Detail pages show `detailLabel`, such as
 * the proxy address, once the page has loaded it.
 */
export function buildTopbarBreadcrumbs(url: string, detailLabel?: string | null): TopbarBreadcrumb[] {
  const path = url.split(/[?#]/, 1)[0];
  const segments = path.split('/').filter(Boolean).map(segment => decodeURIComponent(segment.split(';', 1)[0]));
  const known = PAGE_BREADCRUMBS[segments.join('/')];
  if (known) {
    return known.map(crumb => ({...crumb}));
  }

  const detail = segments.length === 2 ? DETAIL_BREADCRUMBS[segments[0]] : undefined;
  if (detail) {
    return [{...detail.parent}, {label: detailLabel?.trim() || detail.fallback}];
  }

  return segments.map(segment => ({label: formatRouteLabel(segment)}));
}

/** The document title for a URL, such as "Proxies · Magpie". */
export function buildDocumentTitle(breadcrumbs: readonly TopbarBreadcrumb[]): string {
  const page = breadcrumbs.at(-1)?.label;
  return page ? `${page} · Magpie` : 'Magpie';
}

function formatRouteLabel(segment: string): string {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/-/g, ' ')
    .replace(/^\w/, character => character.toUpperCase());
}
