import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private static isAuthenticated = false

  public static isLoggedIn() {
    return UserService.isAuthenticated;
  }

  public static setLoggedIn(loggedIn: boolean) {
    this.isAuthenticated = loggedIn;
  }
}
