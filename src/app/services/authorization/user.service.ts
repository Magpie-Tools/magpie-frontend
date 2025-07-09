import {Injectable} from '@angular/core';
import {HttpService} from '../http.service';
import {Router} from '@angular/router';
import {SnackbarService} from '../snackbar.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private static isAuthenticated = false
  private static role = 'user';

  constructor(private http: HttpService, private router: Router) {
    if (UserService.isAuthenticated) {
      this.getAndSetRole()
    }
  }

  public getAndSetRole() {
    this.http.getUserRole().subscribe({
      next: res => {UserService.role = res;},
      error: err => SnackbarService.openSnackbarDefault("Error while getting user role! " + err.error.message)
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
  }

  public static isAdmin() {
    return UserService.role === 'admin';
  }

  public static logout() {
    localStorage.removeItem('magpie-jwt');
    UserService.setLoggedIn(false);
    UserService.setRole('user');
  }

  public logoutAndRedirect() {
    UserService.logout()
    this.router.navigate(['/login']);
  }


}
