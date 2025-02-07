import { Injectable } from '@angular/core';
import {UserService} from './user.service';
import {CanActivate, Router} from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuardService implements CanActivate{

  constructor(private router: Router) { }

  canActivate(): boolean {
    if (!UserService.isLoggedIn()) {
      this.router.navigate(["login"])
      return false;
    }

    return true;
  }
}
