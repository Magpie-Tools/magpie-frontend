import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { GlobalSettings } from '../models/GlobalSettings';
import { HttpService } from './http.service';
import {UserSettings} from '../models/UserSettings';
import {UserService} from './authorization/user.service';
import {NotificationService} from './notification-service.service';

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
    this.http.getUserSettings().subscribe({
      next: res => this.userSettings = res,
      error: err => NotificationService.showError("Error while getting user settings" + err.error.message)
      })

    if (UserService.isAdmin()) {
      this.http.getGlobalSettings().subscribe({
        next: res => {
          this.settings = res;
          this.settingsSubject.next(this.settings);
        },
        error: err => {
          NotificationService.showError("Error while getting global settings " + err.error.message)
        }
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
      filter((settings): settings is GlobalSettings => settings !== undefined),
      map(settings => settings.checker)
    );
  }

  getScraperSettings(): Observable<GlobalSettings['scraper']> {
    return this.settings$.pipe(
      filter((settings): settings is GlobalSettings => settings !== undefined),
      map(settings => settings.scraper)
    );
  }

  getProxyLimitSettings(): Observable<GlobalSettings['proxy_limits']> {
    return this.settings$.pipe(
      filter((settings): settings is GlobalSettings => settings !== undefined),
      map(settings => settings.proxy_limits)
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

  saveUserScrapingSources(sources: string[]): Observable<any> {
    if (this.userSettings) {
      this.userSettings.scraping_sources = sources
    }
    return this.http.saveUserScrapingSites(sources)
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
      judges: formData.judges,
      scraping_sources: [] // Not needed here
    };
  }

  saveGlobalSettings(formData: any): Observable<any> {
    const payload = this.transformGlobalSettings(formData);
    this.settings = payload;
    this.settingsSubject.next(this.settings);
    return this.http.saveGlobalSettings(payload);
  }

  private transformGlobalSettings(formData: any): GlobalSettings {
    const current = this.settings;

    /* ---------- 1. protocols ---------- */
    const protocols: GlobalSettings['protocols'] = {
      http:   formData?.protocols?.http   ?? current?.protocols?.http   ?? false,
      https:  formData?.protocols?.https  ?? current?.protocols?.https  ?? true,
      socks4: formData?.protocols?.socks4 ?? current?.protocols?.socks4 ?? false,
      socks5: formData?.protocols?.socks5 ?? current?.protocols?.socks5 ?? false
    };

    /* ---------- 2. checker ---------- */
    const checker: GlobalSettings['checker'] = {
      dynamic_threads: formData.dynamic_threads      ?? current?.checker?.dynamic_threads      ?? true,
      threads:         formData.threads              ?? current?.checker?.threads              ?? 250,
      retries:         formData.retries              ?? current?.checker?.retries              ?? 2,
      timeout:         formData.timeout              ?? current?.checker?.timeout              ?? 7500,

      checker_timer: {
        days:    formData?.checker_timer?.days    ?? current?.checker?.checker_timer?.days    ?? 0,
        hours:   formData?.checker_timer?.hours   ?? current?.checker?.checker_timer?.hours   ?? 6,
        minutes: formData?.checker_timer?.minutes ?? current?.checker?.checker_timer?.minutes ?? 0,
        seconds: formData?.checker_timer?.seconds ?? current?.checker?.checker_timer?.seconds ?? 0
      },

      judges_threads: formData.judges_threads      ?? current?.checker?.judges_threads      ?? 3,
      judges_timeout: formData.judges_timeout      ?? current?.checker?.judges_timeout      ?? 5000,

      judge_timer: {
        days:    formData?.judge_timer?.days    ?? current?.checker?.judge_timer?.days    ?? 0,
        hours:   formData?.judge_timer?.hours   ?? current?.checker?.judge_timer?.hours   ?? 0,
        minutes: formData?.judge_timer?.minutes ?? current?.checker?.judge_timer?.minutes ?? 30,
        seconds: formData?.judge_timer?.seconds ?? current?.checker?.judge_timer?.seconds ?? 0
      },

      judges:             formData.judges             ?? current?.checker?.judges             ?? [],
      use_https_for_socks:formData.use_https_for_socks?? current?.checker?.use_https_for_socks?? true,
      ip_lookup:          formData.iplookup           ?? current?.checker?.ip_lookup          ?? '',

      standard_header: formData.standard_header ?? current?.checker?.standard_header ?? [],

      proxy_header: formData.proxy_header ?? current?.checker?.proxy_header ?? []
    };

    /* ---------- 3. scraper ---------- */
    const scraperSitesFromForm: string[] | undefined = (() => {
      if (Array.isArray(formData.scrape_sites)) {
        return formData.scrape_sites as string[];
      }

      if (typeof formData.scrape_sites === 'string') {
        return formData.scrape_sites
          .split(/\r?\n/)
          .flatMap((segment: string) =>
            segment
              .split(/,(?=\s*https?:\/\/)/)
              .map((site: string) => site.trim())
              .filter((site: string) => site.length > 0)
          );
      }

      return undefined;
    })();

    const normalizedSites: string[] = (scraperSitesFromForm ?? current?.scraper?.scrape_sites ?? [])
      .map((site: string) => site.trim())
      .filter((site: string) => site.length > 0);

    const scrapeSites: string[] = Array.from(new Set<string>(normalizedSites));

    const scraper: GlobalSettings['scraper'] = {
      dynamic_threads: formData.scraper_dynamic_threads ?? current?.scraper?.dynamic_threads ?? true,
      threads:         formData.scraper_threads         ?? current?.scraper?.threads         ?? 250,
      retries:         formData.scraper_retries         ?? current?.scraper?.retries         ?? 2,
      timeout:         formData.scraper_timeout         ?? current?.scraper?.timeout         ?? 7500,

      scraper_timer: {
        days:    formData?.scraper_timer?.days    ?? current?.scraper?.scraper_timer?.days    ?? 0,
        hours:   formData?.scraper_timer?.hours   ?? current?.scraper?.scraper_timer?.hours   ?? 9,
        minutes: formData?.scraper_timer?.minutes ?? current?.scraper?.scraper_timer?.minutes ?? 0,
        seconds: formData?.scraper_timer?.seconds ?? current?.scraper?.scraper_timer?.seconds ?? 0
      },

      scrape_sites: scrapeSites
    };

    /* ---------- 4. proxy limits ---------- */
    const proxy_limits: GlobalSettings['proxy_limits'] = {
      enabled:        formData.proxy_limit_enabled        ?? current?.proxy_limits?.enabled        ?? false,
      max_per_user:   formData.proxy_limit_max_per_user   ?? current?.proxy_limits?.max_per_user   ?? 0,
      exclude_admins: formData.proxy_limit_exclude_admins ?? current?.proxy_limits?.exclude_admins ?? true
    };

    /* ---------- 4. blacklist ---------- */
    const blacklist_sources =
      formData.blacklisted ?? current?.blacklist_sources ?? [];

    /* ---------- 5. GeoLite ---------- */
    const geoliteForm = formData.geolite ?? {};
    const geoliteTimer = geoliteForm.update_timer ?? {};

    const geolite: GlobalSettings['geolite'] = {
      api_key: geoliteForm.api_key ?? current?.geolite?.api_key ?? '',
      auto_update: geoliteForm.auto_update ?? current?.geolite?.auto_update ?? false,
      update_timer: {
        days: geoliteTimer?.days ?? current?.geolite?.update_timer?.days ?? 1,
        hours: geoliteTimer?.hours ?? current?.geolite?.update_timer?.hours ?? 0,
        minutes: geoliteTimer?.minutes ?? current?.geolite?.update_timer?.minutes ?? 0,
        seconds: geoliteTimer?.seconds ?? current?.geolite?.update_timer?.seconds ?? 0
      },
      last_updated_at: geoliteForm.last_updated_at ?? current?.geolite?.last_updated_at ?? null
    };

    /* ---------- final shape ---------- */
    return { protocols, checker, scraper, proxy_limits, geolite, blacklist_sources };
  }

}
