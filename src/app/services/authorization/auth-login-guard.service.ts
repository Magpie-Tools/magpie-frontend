import {Injectable} from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { HttpService } from '../http.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class AuthLoginGuardService implements CanActivate {
  constructor(
    private http: HttpService,
    private router: Router,
    private userService: UserService
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    const token = typeof window !== 'undefined'
      ? window.localStorage.getItem('magpie-jwt')
      : null;

    if (!token) {
      return of(true);
    }

    return this.http.checkLogin().pipe(
      tap(() => {
        UserService.setLoggedIn(true);
        this.userService.getAndSetRole();
      }),
      map(() => this.router.createUrlTree(['/'])),
      catchError(() => of(true))
    );
  }
}
