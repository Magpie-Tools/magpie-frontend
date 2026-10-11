import {buildCountryMapPreview, COUNTRY_PREVIEW_HEIGHT, COUNTRY_PREVIEW_WIDTH} from './country-map-preview';
import {resolveWorldCountry} from './world-map';

describe('Country map previews', () => {
  it('resolves country names, aliases, and region codes without marking unknown locations', () => {
    for (const name of ['United States', 'USA', 'us']) {
      expect(resolveWorldCountry(name, true)?.properties.name).toBe('United States of America');
    }
    expect(resolveWorldCountry('DE', true)?.properties.name).toBe('Germany');
    expect(resolveWorldCountry('Congo (DRC)', true)?.properties.name).toBe('Dem. Rep. Congo');
    expect(resolveWorldCountry('Cote d’Ivoire', true)?.properties.name).toBe("Côte d'Ivoire");
    expect(resolveWorldCountry('Central African Republic', true)?.properties.name).toBe('Central African Rep.');
    expect(resolveWorldCountry('South Sudan', true)?.properties.name).toBe('S. Sudan');
    for (const name of ['', 'Unknown', 'N/A', 'UNK', 'Others', 'Atlantis', 'ZZ', 'GBR']) {
      expect(resolveWorldCountry(name, true)).withContext(name).toBeUndefined();
    }
  });

  it('keeps countries, including ones across the date line, visible near the center', () => {
    for (const name of ['Germany', 'United States', 'France', 'Russia', 'Fiji', 'New Zealand']) {
      const country = resolveWorldCountry(name, true)!;
      const map = buildCountryMapPreview(country);
      expect(map.marker[0]).withContext(name).toBeGreaterThan(COUNTRY_PREVIEW_WIDTH * 0.2);
      expect(map.marker[0]).withContext(name).toBeLessThan(COUNTRY_PREVIEW_WIDTH * 0.8);
      expect(map.marker[1]).withContext(name).toBeGreaterThan(COUNTRY_PREVIEW_HEIGHT * 0.2);
      expect(map.marker[1]).withContext(name).toBeLessThan(COUNTRY_PREVIEW_HEIGHT * 0.8);
      expect(map.selectedPath).withContext(name).toBeTruthy();
      expect(map.selectedPath).withContext(name).not.toMatch(/NaN|Infinity/);
      expect(map.countries.some(region => region.name === 'Antarctica')).toBeFalse();
    }
  });

  it('centers mainland France instead of the Atlantic between its overseas territories', () => {
    const map = buildCountryMapPreview(resolveWorldCountry('France', true)!);
    // French Guiana must not appear in a close view of mainland France.
    expect(map.countries.find(region => region.name === 'Suriname')?.path).toBeNull();
    expect(map.countries.find(region => region.name === 'Germany')?.path).toBeTruthy();
  });

  it('marks small countries omitted from the dashboard atlas at the center of the map', () => {
    for (const name of ['Singapore', 'SG', 'Hong Kong', 'Malta', 'Saint Lucia']) {
      const country = resolveWorldCountry(name, true)!;
      expect(country).withContext(name).toBeDefined();
      const map = buildCountryMapPreview(country);
      expect(map.marker[0]).withContext(name).toBeCloseTo(COUNTRY_PREVIEW_WIDTH / 2, 5);
      expect(map.marker[1]).withContext(name).toBeCloseTo(COUNTRY_PREVIEW_HEIGHT / 2, 5);
      expect(map.countries.some(region => region.path)).toBeTrue();
    }
  });
});
