import { Injectable } from '@angular/core';
import {environment} from '../../environments/environment';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {User} from '../models/userModel';
import {jwtToken} from '../models/jwtToken';

@Injectable({
  providedIn: 'root'
})
export class HttpService {
  private apiUrl = environment.apiUrl;

  private jwtToken = ""

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json',
    })
  };

  constructor(private http: HttpClient) { }

  public setJWTToken(token: string) {
    this.jwtToken = "Bearer " + token;
    this.httpOptions.headers = this.httpOptions.headers.set('Authorization', this.jwtToken);
  }

  registerUser(user: User) {
    return this.http.post<jwtToken>(this.apiUrl + '/register', user);
  }

  loginUser(user: User) {
    return this.http.post<jwtToken>(this.apiUrl + '/login', user);
  }

  uploadProxies(formData: FormData) {
    return this.http.post(this.apiUrl + '/addProxies', formData);
  }

}
