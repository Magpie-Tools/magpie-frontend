import {HttpHandler, HttpRequest, HttpResponse} from '@angular/common/http';
import {of} from 'rxjs';
import {AuthInterceptor} from './auth-interceptor.interceptor';
import {clearAuthToken, saveAuthToken} from './authorization/auth-token-storage';

describe('AuthInterceptor', () => {
  beforeEach(() => {
    AuthInterceptor.setToken('');
    clearAuthToken();
    window.localStorage.removeItem('magpie-workspace-id');
  });

  afterEach(() => {
    AuthInterceptor.setToken('');
    clearAuthToken();
    window.localStorage.removeItem('magpie-workspace-id');
  });

  it('uses the current-tab token after a page reload', () => {
    saveAuthToken('session-token', false);
    window.localStorage.setItem('magpie-workspace-id', '12');
    let handledRequest: HttpRequest<unknown> | undefined;
    const next: HttpHandler = {
      handle: request => {
        handledRequest = request;
        return of(new HttpResponse({status: 200}));
      },
    };

    new AuthInterceptor().intercept(new HttpRequest('GET', '/test'), next).subscribe();

    expect(handledRequest?.headers.get('Authorization')).toBe('Bearer session-token');
    expect(handledRequest?.headers.get('X-Workspace-ID')).toBe('12');
  });
});
