import { Injectable } from '@angular/core';
import {UserService} from './user.service';
import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree} from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuardService implements CanActivate{

  constructor(private router: Router) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    if (!UserService.isLoggedIn()) {
      if (typeof window !== 'undefined' && state.url) {
        window.sessionStorage.setItem('magpie-return-url', state.url);
      }

      return this.router.createUrlTree(["login"]);
    }

    return true;
  }
}
