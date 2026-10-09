import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {AlertDestination, AlertDestinationWrite, AlertRotator, AlertRule, AlertRuleWrite, AlertsPage} from '../models/Alert';

@Injectable({providedIn: 'root'})
export class AlertsService {
  private readonly url = `${environment.apiUrl}/alerts`;
  constructor(private readonly http: HttpClient) {}
  load(before = 0) {
    const params = before ? new HttpParams().set('before', before) : new HttpParams();
    return this.http.get<AlertsPage>(this.url, {params});
  }
  rotators() { return this.http.get<AlertRotator[]>(`${this.url}/rotators`); }
  saveRule(id: number | null, payload: AlertRuleWrite) {
    return id === null ? this.http.post<AlertRule>(`${this.url}/rules`, payload) : this.http.put<AlertRule>(`${this.url}/rules/${id}`, payload);
  }
  deleteRule(id: number) { return this.http.delete<void>(`${this.url}/rules/${id}`); }
  saveDestination(id: number | null, payload: AlertDestinationWrite) {
    return id === null ? this.http.post<AlertDestination>(`${this.url}/destinations`, payload) : this.http.put<AlertDestination>(`${this.url}/destinations/${id}`, payload);
  }
  deleteDestination(id: number) { return this.http.delete<void>(`${this.url}/destinations/${id}`); }
  retryDelivery(id: number) { return this.http.post<void>(`${this.url}/deliveries/${id}/retry`, {}); }
}
