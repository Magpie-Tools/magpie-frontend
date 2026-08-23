import {normalizeProxyTableColumns} from './proxy-table-columns';

describe('proxy-table-columns', () => {
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
