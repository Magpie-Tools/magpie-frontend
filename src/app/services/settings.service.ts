import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { GlobalSettings } from '../models/GlobalSettings';
import { HttpService } from './http.service';
import {UserSettings} from '../models/UserSettings';
import {UserService} from './authorization/user.service';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private settings: GlobalSettings | undefined;
  private userSettings: UserSettings | undefined;
  private settingsSubject = new BehaviorSubject<GlobalSettings | undefined>(undefined);
  public settings$ = this.settingsSubject.asObservable();

  constructor(private http: HttpService) {
    this.loadSettings();
  }

  loadSettings(): void {
    this.http.getUserSettings().subscribe(res => {
      this.userSettings = res
    })

    if (UserService.isAdmin()) {
      this.http.getGlobalSettings().subscribe(res => {
        this.settings = res;
        this.settingsSubject.next(this.settings);
      });
    }

  }

  getGlobalSettings(): GlobalSettings | undefined {
    return this.settings;
  }

  getUserSettings(): UserSettings | undefined {
    return this.userSettings;
  }

  getCheckerSettings(): Observable<GlobalSettings['checker']> {
    return this.settings$.pipe(
      map(settings => {
        if (!settings) {
          throw new Error('Settings not loaded');
        }
        return settings.checker;
      })
    );
  }

  getScraperSettings(): Observable<GlobalSettings['scraper']> {
    return this.settings$.pipe(
      map(settings => {
        if (!settings) {
          throw new Error('Settings not loaded');
        }
        return settings.scraper;
      })
    );
  }

  getProtocols(): GlobalSettings["protocols"] | undefined {
    return this.settings?.protocols;
  }

  getBlacklistSources(): string[] | undefined {
    return this.settings?.blacklist_sources;
  }

  saveUserSettings(formData: any): Observable<any> {
    const payload = this.transformUserSettings(formData);
    this.userSettings = payload
    return this.http.saveUserSettings(payload);
  }

  private transformUserSettings(formData: any): UserSettings {
    return {
      http_protocol: formData.HTTPProtocol,
      https_protocol: formData.HTTPSProtocol,
      socks4_protocol: formData.SOCKS4Protocol,
      socks5_protocol: formData.SOCKS5Protocol,
      timeout: formData.Timeout,
      retries: formData.Retries,
      UseHttpsForSocks: formData.UseHttpsForSocks,
      judges: formData.Judges
    };
  }

  saveGlobalSettings(formData: any): Observable<any> {
    const payload = this.transformGlobalSettings(formData);
    return this.http.saveGlobalSettings(payload);
  }

  private transformGlobalSettings(formData: any): GlobalSettings {
    const protocols: GlobalSettings["protocols"] = {
      http: formData.protocols.http,
      https: formData.protocols.https,
      socks4: formData.protocols.socks4,
      socks5: formData.protocols.socks5
    };

    return {
      protocols: protocols,
      checker: {
        threads: formData.threads,
        retries: formData.retries,
        timeout: formData.timeout,
        checker_timer: {
          days: formData.timer.days,
          hours: formData.timer.hours,
          minutes: formData.timer.minutes,
          seconds: formData.timer.seconds
        },
        judges_threads: formData.judges_threads,
        judges_timeout: formData.judges_timeout,
        judge_timer: {
          days: formData.judge_timer?.days || 0,
          hours: formData.judge_timer?.hours || 0,
          minutes: formData.judge_timer?.minutes || 30,
          seconds: formData.judge_timer?.seconds || 0
        },
        judges: formData.judges,
        use_https_for_socks: formData.use_https_for_socks,
        ip_lookup: formData.iplookup,
        standard_header: formData.standard_header || ["USER-AGENT", "HOST", "ACCEPT", "ACCEPT-ENCODING"],
        proxy_header: formData.proxy_header || ["HTTP_X_FORWARDED_FOR", "HTTP_FORWARDED", "HTTP_VIA", "HTTP_X_PROXY_ID"]
      },
      scraper: {
        dynamic_threads: formData.dynamic_threads || false,
        threads: formData.scraper_threads || 250,
        retries: formData.scraper_retries || 2,
        timeout: formData.scraper_timeout || 7500,
        scraper_timer: {
          days: formData.scraper_timer?.days || 0,
          hours: formData.scraper_timer?.hours || 0,
          minutes: formData.scraper_timer?.minutes || 5,
          seconds: formData.scraper_timer?.seconds || 0
        }
      },
      blacklist_sources: formData.blacklisted
    };
  }
}
