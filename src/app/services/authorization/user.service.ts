import {Injectable} from '@angular/core';
import {HttpService} from '../http.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private static isAuthenticated = false
  private static role = 'user';

  constructor(private http: HttpService) {
    if (UserService.isAuthenticated) {
      this.getAndSetRole()
    }
  }

  public getAndSetRole() {
    this.http.getUserRole().subscribe(res => {UserService.role = res;})
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
}
