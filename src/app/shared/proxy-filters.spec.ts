import {FormBuilder} from '@angular/forms';
import {
  activeProxyFilterCount,
  buildBulkProxyFilters,
  createProxyFilterControls,
  buildFiltersFromFormValue,
  buildProxyListFilterPayload,
  createDefaultProxyFilterValues,
} from './proxy-filters';

describe('proxy-filters', () => {
  it('builds health filter values into applied filters and payload', () => {
    const formValue = {
      ...createDefaultProxyFilterValues(),
      minHealthOverall: 65,
      minHealthHttp: 100,
      minHealthHttps: 101,
      minHealthSocks4: -2,
      minHealthSocks5: 45,
    };

    const filters = buildFiltersFromFormValue(formValue);

    expect(filters.minHealthOverall).toBe(65);
    expect(filters.minHealthHttp).toBe(100);
    expect(filters.minHealthHttps).toBe(100);
    expect(filters.minHealthSocks4).toBe(0);
    expect(filters.minHealthSocks5).toBe(45);

    expect(activeProxyFilterCount(filters)).toBe(4);
    expect(buildProxyListFilterPayload(filters)).toEqual({
      minHealthOverall: 65,
      minHealthHttp: 100,
      minHealthHttps: 100,
      minHealthSocks5: 45,
    });
  });

  it('normalizes proxy tag selections and emits one active tag filter', () => {
    const filters = buildFiltersFromFormValue({
      ...createDefaultProxyFilterValues(),
      tagIds: [7, 3, 7, 0, -1, 2.5],
    });

    expect(filters.tagIds).toEqual([7, 3]);
    expect(activeProxyFilterCount(filters)).toBe(1);
    expect(buildProxyListFilterPayload(filters)).toEqual({tagIds: [7, 3]});
  });
});

describe('bulk proxy filters', () => {
  it('disables every filter even when the form retains selections', () => {
    const values = {
      ...createDefaultProxyFilterValues(),
      http: true,
      proxyStatus: 'alive' as const,
      minHealthOverall: 75,
      maxTimeout: 1000,
      countries: ['DE'],
      tagIds: [5],
    };
    expect(buildBulkProxyFilters(values, false)).toEqual({...createDefaultProxyFilterValues(), filter: false});
  });

  it('normalizes bounds and selections consistently for export and delete', () => {
    const values = {
      ...createDefaultProxyFilterValues(),
      http: true,
      minHealthOverall: 125,
      minHealthHttp: -1,
      maxRetries: 2.9,
      countries: [' DE ', 'DE', ''],
      tagIds: [5, 5, -1, 2.5],
    };
    expect(buildBulkProxyFilters(values, true)).toEqual(jasmine.objectContaining({
      filter: true, http: true, minHealthOverall: 100, minHealthHttp: 0,
      maxRetries: 2, countries: ['DE'], tagIds: [5],
    }));
  });

  it('builds array-valued controls without sharing mutable defaults', () => {
    const defaults = {...createDefaultProxyFilterValues(), countries: ['DE'], tagIds: [5]};
    const form = new FormBuilder().group(createProxyFilterControls(defaults));
    expect(form.getRawValue()).toEqual(defaults);
    form.get('countries')!.value!.push('FR');
    expect(defaults.countries).toEqual(['DE']);
  });
});
