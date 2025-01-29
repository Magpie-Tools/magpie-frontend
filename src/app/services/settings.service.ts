import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {environment} from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  constructor(private http: HttpClient) {}

  saveSettings(formData: any): Observable<any> {
    const payload = this.transformSettings(formData);
    return this.http.post(environment.apiUrl + "/saveSettings", payload, { responseType: 'text' });  }

  private transformSettings(formData: any) {
    return {
      protocols: formData.selectedPorts,
      timer: {
        days: formData.timer.days,
        hours: formData.timer.hours,
        minutes: formData.timer.minutes,
        seconds: formData.timer.seconds
      },
      checker: {
        threads: formData.threads,
        retries: formData.retries,
        timeout: formData.timeout,
        judges_threads: formData.judges_threads,
        judges_timeout: formData.judges_timeout,
        judges: formData.judges,
        ip_lookup: formData.iplookup,
        standard_header: ["USER-AGENT", "HOST", "ACCEPT", "ACCEPT-ENCODING"],
        proxy_header: ["HTTP_X_FORWARDED_FOR", "HTTP_FORWARDED", "HTTP_VIA", "HTTP_X_PROXY_ID"]
      },
      blacklist_sources: formData.blacklisted
    };
  }
}
