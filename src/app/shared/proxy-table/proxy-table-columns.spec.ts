import {DEFAULT_PROXY_TABLE_COLUMNS, normalizeProxyTableColumns} from './proxy-table-columns';

describe('proxy-table-columns', () => {
  it('keeps the menu as the default and preserves an optional buttons column', () => {
    expect(DEFAULT_PROXY_TABLE_COLUMNS).toContain('actions');
    expect(DEFAULT_PROXY_TABLE_COLUMNS).not.toContain('actions_buttons');
    expect(normalizeProxyTableColumns(['ip_port', 'actions_buttons'])).toEqual([
      'ip_port', 'tags', 'actions_buttons',
    ]);
  });

  it('inserts the required tags column after the saved host column', () => {
    expect(normalizeProxyTableColumns(['alive', 'ip_port', 'country'])).toEqual([
      'alive',
      'ip_port',
      'tags',
      'country',
    ]);
  });

  it('keeps a saved tags column in its chosen position without duplicating it', () => {
    expect(normalizeProxyTableColumns(['tags', 'alive', 'ip_port', 'tags'])).toEqual([
      'tags',
      'alive',
      'ip_port',
    ]);
  });
});
