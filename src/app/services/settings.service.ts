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
        days: formData.days || 0,
        hours: formData.hours || 12,
        minutes: formData.minutes || 0,
        seconds: formData.seconds || 0
      },
      checker: {
        threads: formData.threads,
        retries: formData.retries,
        timeout: formData.timeout,
        judges_threads: formData.judges_threads,
        judges_timeout: formData.judges_timeout,
        judges: formData.judges,
        ip_lookup: formData.iplookup,
        current_ip: "", // You may need to fetch this separately
        standard_header: ["USER-AGENT", "HOST", "ACCEPT", "ACCEPT-ENCODING"],
        proxy_header: ["HTTP_X_FORWARDED_FOR", "HTTP_FORWARDED", "HTTP_VIA", "HTTP_X_PROXY_ID"]
      },
      blacklist_sources: formData.blacklisted
    };
  }
}
