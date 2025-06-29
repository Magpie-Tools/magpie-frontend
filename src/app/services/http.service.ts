import { Injectable } from '@angular/core';
import {environment} from '../../environments/environment';
import {HttpClient} from '@angular/common/http';
import {User} from '../models/UserModel';
import {jwtToken} from '../models/JwtToken';
import {ProxyInfo} from '../models/ProxyInfo';
import {GlobalSettings} from '../models/GlobalSettings';
import {UserSettings} from '../models/UserSettings';
import {ExportSettings} from '../models/ExportSettings';
import {ScrapeSourceInfo} from '../models/ScrapeSourceInfo';
import {DashboardInfo} from '../models/DashboardInfo';
import {ChangePassword} from '../models/ChangePassword';

@Injectable({
  providedIn: 'root'
})
export class HttpService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  checkLogin() {
    return this.http.get(this.apiUrl + '/checkLogin')
  }

  registerUser(user: User) {
    return this.http.post<jwtToken>(this.apiUrl + '/register', user)
  }

  loginUser(user: User) {
    return this.http.post<jwtToken>(this.apiUrl + '/login', user)
  }

  changePassword(changePassword: ChangePassword) {
    return this.http.post<string>(this.apiUrl + '/changePassword', changePassword)
  }

  uploadProxies(formData: FormData) {
    return this.http.post<{proxyCount: number}>(this.apiUrl + '/addProxies', formData);
  }

  deleteProxies(proxies: number[]) {
    return this.http.request<string>('delete', this.apiUrl + '/proxies', {
      body: proxies,
    });
  }


  getProxyPage(pageNumber: number) {
    return this.http.get<ProxyInfo[]>(this.apiUrl + '/getProxyPage/' + pageNumber);
  }

  getProxyCount() {
    return this.http.get<number>(this.apiUrl + '/getProxyCount');
  }


  saveGlobalSettings(payload: GlobalSettings) {
    return this.http.post(environment.apiUrl + "/saveSettings", payload)
  }

  getGlobalSettings() {
    return this.http.get<GlobalSettings>(this.apiUrl + '/global/settings');
  }

  getUserSettings() {
    return this.http.get<UserSettings>(this.apiUrl + '/user/settings');
  }

  saveUserSettings(payload: UserSettings) {
    return this.http.post(environment.apiUrl + "/user/settings", payload)
  }

  saveUserScrapingSites(payload: string[]) {
    return this.http.post(environment.apiUrl + "/user/scrapingSites", payload)
  }

  getUserRole() {
    return this.http.get<string>(this.apiUrl + '/user/role');
  }

  exportProxies(settings: ExportSettings) {
    return this.http.post<string>(this.apiUrl + '/user/export', settings)
  }

  uploadScrapeSources(formData: FormData) {
    return this.http.post<{sourceCount: number}>(this.apiUrl + '/scrapingSources', formData);
  }

  getScrapingSourcesCount() {
    return this.http.get<number>(this.apiUrl + '/getScrapingSourcesCount');
  }

  getScrapingSourcePage(pageNumber: number) {
    return this.http.get<ScrapeSourceInfo[]>(this.apiUrl + '/getScrapingSourcesPage/' + pageNumber);
  }

  deleteScrapingSource(proxies: number[]) {
    return this.http.request<string>('delete', this.apiUrl + '/scrapingSources', {
      body: proxies,
    });
  }

  getDashboardInfo() {
    return this.http.get<DashboardInfo>(this.apiUrl + '/getDashboardInfo');
  }
}
