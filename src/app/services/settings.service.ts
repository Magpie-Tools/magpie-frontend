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
      judges: formData.judges
    };
  }

  saveGlobalSettings(formData: any): Observable<any> {
    const payload = this.transformGlobalSettings(formData);
    return this.http.saveGlobalSettings(payload);
  }

  private transformGlobalSettings(formData: any): GlobalSettings {
    const current = this.settings;

    /* ---------- 1. protocols ---------- */
    const protocols: GlobalSettings['protocols'] = {
      http:   formData?.protocols?.http   ?? current?.protocols.http,
      https:  formData?.protocols?.https  ?? current?.protocols.https,
      socks4: formData?.protocols?.socks4 ?? current?.protocols.socks4,
      socks5: formData?.protocols?.socks5 ?? current?.protocols.socks5
    };

    /* ---------- 2. checker ---------- */
    const checker: GlobalSettings['checker'] = {
      dynamic_threads: formData.dynamic_threads      ?? current?.checker.dynamic_threads,
      threads:         formData.threads              ?? current?.checker.threads,
      retries:         formData.retries              ?? current?.checker.retries,
      timeout:         formData.timeout              ?? current?.checker.timeout,

      checker_timer: {
        days:    formData?.checker_timer?.days    ?? current?.checker.checker_timer.days,
        hours:   formData?.checker_timer?.hours   ?? current?.checker.checker_timer.hours,
        minutes: formData?.checker_timer?.minutes ?? current?.checker.checker_timer.minutes,
        seconds: formData?.checker_timer?.seconds ?? current?.checker.checker_timer.seconds
      },

      judges_threads: formData.judges_threads      ?? current?.checker.judges_threads,
      judges_timeout: formData.judges_timeout      ?? current?.checker.judges_timeout,

      judge_timer: {
        days:    formData?.judge_timer?.days    ?? current?.checker.judge_timer.days,
        hours:   formData?.judge_timer?.hours   ?? current?.checker.judge_timer.hours,
        minutes: formData?.judge_timer?.minutes ?? current?.checker.judge_timer.minutes,
        seconds: formData?.judge_timer?.seconds ?? current?.checker.judge_timer.seconds
      },

      judges:             formData.judges             ?? current?.checker.judges,
      use_https_for_socks:formData.use_https_for_socks?? current?.checker.use_https_for_socks,
      ip_lookup:          formData.iplookup           ?? current?.checker.ip_lookup,

      standard_header: formData.standard_header ?? current?.checker.standard_header,

      proxy_header: formData.proxy_header ?? current?.checker.proxy_header
    };

    /* ---------- 3. scraper ---------- */
    const scraper: GlobalSettings['scraper'] = {
      dynamic_threads: formData.scraper_dynamic_threads ?? current?.scraper.dynamic_threads,
      threads:         formData.scraper_threads         ?? current?.scraper.threads,
      retries:         formData.scraper_retries         ?? current?.scraper.retries,
      timeout:         formData.scraper_timeout         ?? current?.scraper.timeout,

      scraper_timer: {
        days:    formData?.scraper_timer?.days    ?? current?.scraper.scraper_timer.days,
        hours:   formData?.scraper_timer?.hours   ?? current?.scraper.scraper_timer.hours,
        minutes: formData?.scraper_timer?.minutes ?? current?.scraper.scraper_timer.minutes,
        seconds: formData?.scraper_timer?.seconds ?? current?.scraper.scraper_timer.seconds
      },

      scrape_sites: formData.scrape_sites ?? current?.scraper.scrape_sites
    };

    /* ---------- 4. blacklist ---------- */
    const blacklist_sources =
      formData.blacklisted ?? current?.blacklist_sources;

    /* ---------- final shape ---------- */
    return { protocols, checker, scraper, blacklist_sources };
  }

}
