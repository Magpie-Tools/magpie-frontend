import { Injectable } from '@angular/core';
import {environment} from '../../environments/environment';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {User} from '../models/userModel';
import {jwtToken} from '../models/jwtToken';
import {ProxyInfo} from '../models/ProxyInfo';
import {GlobalSettings} from '../models/GlobalSettings';
import {UserSettings} from '../models/UserSettings';
import {ExportSettings} from '../models/ExportSettings';

@Injectable({
  providedIn: 'root'
})
export class HttpService {
  private apiUrl = environment.apiUrl;

  private jwtToken = ""

  httpOptions = {
    headers: new HttpHeaders({
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
    return this.http.post<{proxyCount: number}>(this.apiUrl + '/addProxies', formData, this.httpOptions);
  }

  deleteProxies(proxies: number[]) {
    return this.http.request<string>('delete', this.apiUrl + '/proxies', {
      body: proxies,
      ...this.httpOptions
    });
  }


  getProxyPage(pageNumber: number) {
    return this.http.get<ProxyInfo[]>(this.apiUrl + '/getProxyPage/' + pageNumber, this.httpOptions);
  }

  getProxyCount() {
    return this.http.get<number>(this.apiUrl + '/getProxyCount', this.httpOptions);
  }


  saveGlobalSettings(payload: GlobalSettings) {
    return this.http.post(environment.apiUrl + "/saveSettings", payload, this.httpOptions)
  }

  getGlobalSettings() {
    return this.http.get<GlobalSettings>(this.apiUrl + '/global/settings', this.httpOptions);
  }

  getUserSettings() {
    return this.http.get<UserSettings>(this.apiUrl + '/user/settings', this.httpOptions);
  }

  saveUserSettings(payload: UserSettings) {
    return this.http.post(environment.apiUrl + "/user/settings", payload, this.httpOptions)
  }

  saveUserScrapingSites(payload: string[]) {
    return this.http.post(environment.apiUrl + "/user/scrapingSites", payload, this.httpOptions)
  }

  getUserRole() {
    return this.http.get<string>(this.apiUrl + '/user/role', this.httpOptions);
  }

  exportProxies(settings: ExportSettings) {
    return this.http.post<string>(this.apiUrl + '/user/export', settings, this.httpOptions)
  }
}
