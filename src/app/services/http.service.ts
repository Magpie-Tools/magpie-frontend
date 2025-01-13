import { Injectable } from '@angular/core';
import {environment} from '../../environments/environment';
import {HttpClient} from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class HttpService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  uploadProxies(formData: FormData) {
    return this.http.post(this.apiUrl + '/addProxies', formData);
  }
}
