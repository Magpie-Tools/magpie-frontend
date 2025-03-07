import { Injectable } from '@angular/core';
import {CanActivate, Router} from '@angular/router';
import {UserService} from './user.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuardAdminService implements CanActivate{

  constructor(private router: Router) { }

  canActivate(): boolean {
    if (!UserService.isLoggedIn() || !UserService.isAdmin()) {
      this.router.navigate(["login"])
      return false;
    }

    return true;
  }
}
