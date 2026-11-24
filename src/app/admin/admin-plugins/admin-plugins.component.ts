import {HlmSwitch} from '@spartan-ng/helm/switch';
import {Component, computed, inject, LOCALE_ID, OnDestroy, OnInit, signal} from '@angular/core';
import {formatNumber, NgTemplateOutlet} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {interval, Subject} from 'rxjs';
import {filter, takeUntil} from 'rxjs/operators';
import {SettingsService} from '../../services/settings.service';
import {HttpService} from '../../services/http.service';
import {GlobalSettings, IPGeolocationStatus} from '../../models/GlobalSettings';
import {NotificationService} from '../../services/notification-service.service';
import {formatTimeAgo} from '../../shared/time-ago';

type PluginId = 'geolite' | 'abuseipdb' | 'ipgeolocation';

interface PluginDefinition {
  id: PluginId;
  name: string;
  provides: string;
  logo: string;
  route: string;
  keyName: string;
}

export type PluginTone = 'good' | 'bad' | 'off';
export type PluginKeyState = 'configured' | 'unset' | 'missing';

export interface PluginStatus {
  tone: PluginTone;
  text: string;
  detail?: string;
}

export interface PluginUsage {
  left: string;
  limit: string;
  usedPercent: number;
  exhausted: boolean;
}

export interface PluginRow extends PluginDefinition {
  enabled: boolean;
  keyState: PluginKeyState;
  status: PluginStatus;
  usage: PluginUsage | null;
  usageText: string;
}

@Component({
  selector: 'app-admin-plugins',
  standalone: true,
  imports: [HlmSwitch, RouterLink, FormsModule, NgTemplateOutlet],
  templateUrl: './admin-plugins.component.html',
  styleUrl: './admin-plugins.component.scss'
})
export class AdminPluginsComponent implements OnInit, OnDestroy {
  readonly plugins: readonly PluginDefinition[] = [
    {
      id: 'geolite',
      name: 'GeoLite',
      provides: 'Location data',
      logo: 'https://www.google.com/s2/favicons?domain=maxmind.com&sz=64',
      route: '/plugins/geolite',
      keyName: 'license key'
    },
    {
      id: 'abuseipdb',
      name: 'AbuseIPDB',
      provides: 'IP reputation',
      logo: 'https://www.google.com/s2/favicons?domain=abuseipdb.com&sz=64',
      route: '/plugins/abuseipdb',
      keyName: 'API key'
    },
    {
      id: 'ipgeolocation',
      name: 'IPGeolocation.io',
      provides: 'Network type and VPN detection',
      logo: 'https://www.google.com/s2/favicons?domain=ipgeolocation.io&sz=64',
      route: '/plugins/ipgeolocation',
      keyName: 'API key'
    }
  ];

  settings = signal<GlobalSettings | undefined>(undefined);
  ipgeolocationStatus = signal<IPGeolocationStatus | null>(null);
  pendingPluginIds = signal<ReadonlySet<string>>(new Set());
  private now = signal(Date.now());

  rows = computed<PluginRow[]>(() => this.plugins.map(plugin => this.buildRow(plugin)));

  private readonly locale = inject(LOCALE_ID);
  private readonly router = inject(Router);
  private readonly http = inject(HttpService);
  private destroy$ = new Subject<void>();

  constructor(
    private settingsService: SettingsService,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.settingsService.settings$
      .pipe(
        filter((settings): settings is GlobalSettings => !!settings),
        takeUntil(this.destroy$)
      )
      .subscribe(settings => this.settings.set(settings));

    this.refreshIPGeolocationStatus();
    interval(60_000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.now.set(Date.now());
      this.refreshIPGeolocationStatus();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openPlugin(row: PluginRow): void {
    void this.router.navigateByUrl(row.route);
  }

  isPluginEnabled(pluginId: string): boolean {
    return this.pluginSettings(pluginId)?.enabled ?? false;
  }

  isPluginConfigured(pluginId: string): boolean {
    return !!this.pluginSettings(pluginId)?.api_key?.trim();
  }

  isPluginTogglePending(pluginId: string): boolean {
    return this.pendingPluginIds().has(pluginId);
  }

  togglePlugin(pluginId: string, enabled: boolean): void {
    const previousSettings = this.settings();
    if (this.isPluginTogglePending(pluginId) || !previousSettings || !this.isPluginId(pluginId)) {
      return;
    }

    this.setPluginEnabled(pluginId, enabled);
    this.setPluginPending(pluginId, true);

    this.settingsService.saveGlobalSettings({ plugins: { [pluginId]: { enabled } } }).subscribe({
      next: () => {
        this.setPluginPending(pluginId, false);
        if (pluginId === 'ipgeolocation') {
          this.refreshIPGeolocationStatus();
        }
      },
      error: (err) => {
        this.settings.set(previousSettings);
        this.setPluginPending(pluginId, false);
        this.notification.showError('Failed to update plugin: ' + (err?.error?.message ?? 'Unknown error'));
      }
    });
  }

  private buildRow(plugin: PluginDefinition): PluginRow {
    const enabled = this.isPluginEnabled(plugin.id);
    const configured = this.isPluginConfigured(plugin.id);
    const keyState: PluginKeyState = configured ? 'configured' : enabled ? 'missing' : 'unset';
    const row: PluginRow = {
      ...plugin,
      enabled,
      keyState,
      status: { tone: 'off', text: configured ? 'Disabled' : 'Not set up' },
      usage: null,
      usageText: '—'
    };

    if (enabled && !configured) {
      row.status = {
        tone: 'bad',
        text: `Enabled without ${plugin.keyName === 'license key' ? 'a' : 'an'} ${plugin.keyName}`,
        detail: 'Lookups are skipped until a key is added.'
      };
    } else if (enabled) {
      row.status = this.activeStatus(plugin.id);
    }

    if (plugin.id === 'geolite') {
      row.usageText = 'Local database';
    } else if (enabled && configured) {
      row.usage = this.usage(plugin.id);
    }
    return row;
  }

  // Status of an enabled plugin that has its key.
  private activeStatus(pluginId: PluginId): PluginStatus {
    const plugins = this.settings()?.plugins;

    if (pluginId === 'geolite') {
      const updated = formatTimeAgo(plugins?.geolite?.last_updated_at, this.now());
      return { tone: 'good', text: updated ? `Database updated ${updated}` : 'Waiting for the first download' };
    }

    if (pluginId === 'abuseipdb') {
      const abuseipdb = plugins?.abuseipdb;
      if (abuseipdb?.last_error?.trim()) {
        return { tone: 'bad', text: 'Last check failed', detail: abuseipdb.last_error };
      }
      if (abuseipdb?.daily_limit) {
        if (abuseipdb.daily_remaining <= 0) {
          return { tone: 'bad', text: 'Daily limit reached' };
        }
        return { tone: 'good', text: `${this.number(abuseipdb.daily_remaining)} of ${this.number(abuseipdb.daily_limit)} checks left today` };
      }
      return { tone: 'good', text: 'Waiting for the first check' };
    }

    const status = this.ipgeolocationStatus();
    if (status?.last_error?.trim()) {
      return { tone: 'bad', text: 'Last lookup failed', detail: status.last_error };
    }
    if (status?.daily_credit_limit) {
      const left = Math.max(0, status.daily_credit_limit - status.used_credits);
      if (left <= 0) {
        return { tone: 'bad', text: 'Daily credit limit reached' };
      }
      return { tone: 'good', text: `${this.number(left)} of ${this.number(status.daily_credit_limit)} credits left today` };
    }
    return { tone: 'good', text: 'Enabled' };
  }

  private usage(pluginId: PluginId): PluginUsage | null {
    if (pluginId === 'abuseipdb') {
      const abuseipdb = this.settings()?.plugins?.abuseipdb;
      return abuseipdb?.daily_limit ? this.toUsage(abuseipdb.daily_remaining, abuseipdb.daily_limit) : null;
    }
    if (pluginId === 'ipgeolocation') {
      const status = this.ipgeolocationStatus();
      return status?.daily_credit_limit
        ? this.toUsage(status.daily_credit_limit - status.used_credits, status.daily_credit_limit)
        : null;
    }
    return null;
  }

  private toUsage(remaining: number, limit: number): PluginUsage {
    const left = Math.max(0, Math.min(limit, remaining));
    return {
      left: this.number(left),
      limit: this.number(limit),
      usedPercent: Math.round((limit - left) / limit * 100),
      exhausted: left <= 0
    };
  }

  private number(value: number): string {
    return formatNumber(value, this.locale, '1.0-0');
  }

  private refreshIPGeolocationStatus(): void {
    this.http.getIPGeolocationStatus().pipe(takeUntil(this.destroy$)).subscribe({
      next: status => this.ipgeolocationStatus.set(status),
      error: () => this.ipgeolocationStatus.set(null)
    });
  }

  private pluginSettings(pluginId: string): { enabled: boolean; api_key: string } | undefined {
    return this.isPluginId(pluginId) ? this.settings()?.plugins?.[pluginId] : undefined;
  }

  private isPluginId(pluginId: string): pluginId is PluginId {
    return pluginId === 'geolite' || pluginId === 'abuseipdb' || pluginId === 'ipgeolocation';
  }

  private setPluginEnabled(pluginId: PluginId, enabled: boolean): void {
    const current = this.settings();
    if (!current) {
      return;
    }

    const plugins = { ...current.plugins };
    if (pluginId === 'ipgeolocation') {
      plugins.ipgeolocation = {
        api_key: '', include_security: false, daily_credit_limit: 300, cache_hours: 168,
        ...current.plugins.ipgeolocation, enabled
      };
    } else if (pluginId === 'geolite') {
      plugins.geolite = { ...current.plugins.geolite, enabled };
    } else {
      plugins.abuseipdb = { ...current.plugins.abuseipdb, enabled };
    }
    this.settings.set({ ...current, plugins });
  }

  private setPluginPending(pluginId: string, pending: boolean): void {
    const next = new Set(this.pendingPluginIds());
    if (pending) {
      next.add(pluginId);
    } else {
      next.delete(pluginId);
    }
    this.pendingPluginIds.set(next);
  }
}
