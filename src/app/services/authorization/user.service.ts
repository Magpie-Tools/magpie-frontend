import {Injectable} from '@angular/core';
import {HttpService} from '../http.service';
import {Router} from '@angular/router';
import {NotificationService} from '../notification-service.service';
import {BehaviorSubject} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private static isAuthenticated = false
  private static role = 'user';
  private static roleSubject = new BehaviorSubject<string | undefined>(undefined);
  public readonly role$ = UserService.roleSubject.asObservable();

  constructor(private http: HttpService, private router: Router) {
    this.initializeSession();
  }

  private initializeSession() {
    if (typeof window === 'undefined') {
      return;
    }

    if (UserService.isAuthenticated) {
      this.getAndSetRole();
      return;
    }

    const token = window.localStorage.getItem('magpie-jwt');
    if (token) {
      UserService.setLoggedIn(true);
      this.getAndSetRole();
    }
  }

  public getAndSetRole() {
    this.http.getUserRole().subscribe({
      next: res => {
        UserService.setLoggedIn(true);
        UserService.setRole(res);
      },
      error: err => {
        if (err.status && err.status !== 401 && err.status !== 403) {
          NotificationService.showError("Error while getting user role! " + err.error.message)
        }
        if (err.status === 401 || err.status === 403) {
          UserService.logout();
        }
      }
    })
  }

  public static isLoggedIn() {
    return UserService.isAuthenticated;
  }

  public static setLoggedIn(loggedIn: boolean) {
    this.isAuthenticated = loggedIn;
  }

  public static setRole(role: string) {
    UserService.role = role;
    UserService.roleSubject.next(role);
  }

  public static isAdmin() {
    return UserService.role === 'admin';
  }

  public static logout() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('magpie-jwt');
    }
    UserService.setLoggedIn(false);
    UserService.setRole('user');
  }

  public logoutAndRedirect() {
    UserService.logout()
    this.router.navigate(['/login']);
  }


}
