const authTokenStorageKey = 'magpie-jwt';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage.getItem(authTokenStorageKey)
    ?? window.localStorage.getItem(authTokenStorageKey);
}

export function saveAuthToken(token: string, remember: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (remember) {
    window.sessionStorage.removeItem(authTokenStorageKey);
    window.localStorage.setItem(authTokenStorageKey, token);
    return;
  }

  window.localStorage.removeItem(authTokenStorageKey);
  window.sessionStorage.setItem(authTokenStorageKey, token);
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(authTokenStorageKey);
  window.sessionStorage.removeItem(authTokenStorageKey);
}
