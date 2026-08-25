import {clearAuthToken, getAuthToken, saveAuthToken} from './auth-token-storage';

describe('auth token storage', () => {
  beforeEach(() => clearAuthToken());
  afterEach(() => clearAuthToken());

  it('stores a non-remembered login for the current tab', () => {
    saveAuthToken('session-token', false);

    expect(window.sessionStorage.getItem('magpie-jwt')).toBe('session-token');
    expect(window.localStorage.getItem('magpie-jwt')).toBeNull();
    expect(getAuthToken()).toBe('session-token');
  });

  it('stores a remembered login across browser sessions', () => {
    window.sessionStorage.setItem('magpie-jwt', 'old-session-token');

    saveAuthToken('remembered-token', true);

    expect(window.sessionStorage.getItem('magpie-jwt')).toBeNull();
    expect(window.localStorage.getItem('magpie-jwt')).toBe('remembered-token');
    expect(getAuthToken()).toBe('remembered-token');
  });

  it('prefers the current tab session if both stores contain a token', () => {
    window.localStorage.setItem('magpie-jwt', 'remembered-token');
    window.sessionStorage.setItem('magpie-jwt', 'current-tab-token');

    expect(getAuthToken()).toBe('current-tab-token');
  });
});
