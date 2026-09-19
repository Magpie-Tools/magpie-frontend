import {
  DEFAULT_SCRAPE_SOURCE_LIST_COLUMNS,
  normalizeScrapeSourceListColumns,
} from './scrape-source-list-columns';

describe('scrape source list columns', () => {
  it('does not include alive proxies in the default columns', () => {
    expect(DEFAULT_SCRAPE_SOURCE_LIST_COLUMNS).not.toContain('alive_count');
  });

  it('preserves both action styles in saved column order', () => {
    expect(normalizeScrapeSourceListColumns(['actions_buttons', 'url', 'actions', 'actions_buttons'])).toEqual([
      'actions_buttons', 'url', 'actions',
    ]);
    expect(DEFAULT_SCRAPE_SOURCE_LIST_COLUMNS).toContain('actions');
    expect(DEFAULT_SCRAPE_SOURCE_LIST_COLUMNS).not.toContain('actions_buttons');
  });

  it('preserves alive proxies when selected', () => {
    expect(normalizeScrapeSourceListColumns(['url', 'alive_count', 'actions'])).toEqual([
      'url',
      'alive_count',
      'actions',
    ]);
  });
});
