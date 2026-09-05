import {Injectable} from '@angular/core';
import {UserService} from './user.service';
import {ActivatedRouteSnapshot, CanActivate, CanActivateChild, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {getAuthToken} from './auth-token-storage';

@Injectable({
  providedIn: 'root'
})
export class AuthGuardService implements CanActivate, CanActivateChild {
  constructor(private router: Router) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree | Promise<boolean | UrlTree> {
    const returnUrl = state.url || '';
    const requiresAdmin = route.data['requiresAdmin'] === true;
    const hasToken = !!getAuthToken();

    if (UserService.authState() === 'checking') {
      this.storeReturnUrl(returnUrl);
      return this.waitForAuthResolution(returnUrl, requiresAdmin);
    }

    if (!UserService.isLoggedIn()) {
      if (hasToken) {
        UserService.setChecking();
        this.storeReturnUrl(returnUrl);
        return this.waitForAuthResolution(returnUrl, requiresAdmin);
      }

      this.storeReturnUrl(returnUrl);
      return this.router.createUrlTree(['login'], {
        queryParams: returnUrl ? { returnUrl } : undefined,
      });
    }

    return this.authorizeAuthenticatedUser(requiresAdmin);
  }

  canActivateChild(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree | Promise<boolean | UrlTree> {
    return this.canActivate(route, state);
  }

  private storeReturnUrl(returnUrl: string): void {
    if (typeof window !== 'undefined' && returnUrl) {
      window.sessionStorage.setItem('magpie-return-url', returnUrl);
    }
  }

  private waitForAuthResolution(returnUrl: string, requiresAdmin: boolean): Promise<boolean | UrlTree> {
    const timeoutMs = 10000;
    const intervalMs = 50;
    const start = Date.now();

    return new Promise(resolve => {
      const tick = () => {
        const state = UserService.authState();
        if (state !== 'checking') {
          if (state === 'authenticated') {
            resolve(this.authorizeAuthenticatedUser(requiresAdmin));
            return;
          }
          resolve(this.router.createUrlTree(['login'], {
            queryParams: returnUrl ? { returnUrl } : undefined,
          }));
          return;
        }

        if (Date.now() - start >= timeoutMs) {
          resolve(this.router.createUrlTree(['login'], {
            queryParams: returnUrl ? { returnUrl } : undefined,
          }));
          return;
        }

        setTimeout(tick, intervalMs);
      };

      tick();
    });
  }

  private authorizeAuthenticatedUser(requiresAdmin: boolean): boolean | UrlTree {
    if (requiresAdmin && !UserService.isAdmin()) {
      return this.router.createUrlTree(['/']);
    }

    return true;
  }
}
