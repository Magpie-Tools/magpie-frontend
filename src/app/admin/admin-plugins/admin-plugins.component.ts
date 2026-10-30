import {HlmSwitch} from '@spartan-ng/helm/switch';
import {HlmTooltip} from '@spartan-ng/helm/tooltip';
import {Component, computed, OnDestroy, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {SettingsService} from '../../services/settings.service';
import {GlobalSettings} from '../../models/GlobalSettings';
import {Subject} from 'rxjs';
import {filter, takeUntil} from 'rxjs/operators';
import {NotificationService} from '../../services/notification-service.service';

import {RevealGroupDirective} from '../../shared/reveal-group.directive';

@Component({
  selector: 'app-admin-plugins',
  standalone: true,
  imports: [HlmSwitch, HlmTooltip,
    RouterLink,
    FormsModule,

    RevealGroupDirective
  ],
  templateUrl: './admin-plugins.component.html',
  styleUrl: './admin-plugins.component.scss'
})
export class AdminPluginsComponent implements OnInit, OnDestroy {
  plugins = [
    {
      id: 'geolite',
      name: 'GeoLite',
      logo: 'https://www.google.com/s2/favicons?domain=maxmind.com&sz=64',
      route: '/plugins/geolite',
      icon: 'icon icon-map-pin',
      description: 'Enrich every proxy with country, city, and network data from MaxMind.',
      capabilities: ['Location data', 'Scheduled updates', 'Local database']
    },
    {
      id: 'abuseipdb',
      name: 'AbuseIPDB',
      logo: 'https://www.google.com/s2/favicons?domain=abuseipdb.com&sz=64',
      route: '/plugins/abuseipdb',
      icon: 'icon icon-shield',
      description: 'Add community abuse intelligence to proxy reputation scoring.',
      capabilities: ['IP reputation', 'Quota tracking', 'Age policy']
    },
    {
      id: 'ipgeolocation',
      name: 'IPGeolocation.io',
      logo: 'https://www.google.com/s2/favicons?domain=ipgeolocation.io&sz=64',
      route: '/plugins/ipgeolocation',
      icon: 'icon icon-globe',
      description: 'Look up network types and location, with optional proxy and VPN intelligence.',
      capabilities: ['Network classification', 'Shared IP cache', 'Credit budget']
    }
  ];

  settings = signal<GlobalSettings | undefined>(undefined);
  pluginStates = computed(() => ({
    geolite: this.settings()?.plugins?.geolite?.enabled ?? false,
    abuseipdb: this.settings()?.plugins?.abuseipdb?.enabled ?? false,
    ipgeolocation: this.settings()?.plugins?.ipgeolocation?.enabled ?? false
  }));
  pendingPluginIds = signal<ReadonlySet<string>>(new Set());
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
      .subscribe(settings => {
        this.settings.set(settings);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isPluginConfigured(pluginId: string): boolean {
    if (pluginId === 'ipgeolocation') {
      return !!this.settings()?.plugins?.ipgeolocation?.api_key?.trim();
    }
    if (pluginId === 'geolite') {
      return !!this.settings()?.plugins?.geolite?.api_key?.trim();
    }
    if (pluginId === 'abuseipdb') {
      return !!this.settings()?.plugins?.abuseipdb?.api_key?.trim();
    }
    return false;
  }

  isPluginEnabled(pluginId: string): boolean {
    if (pluginId === 'ipgeolocation') {
      return this.pluginStates().ipgeolocation;
    }
    if (pluginId === 'geolite') {
      return this.pluginStates().geolite;
    }
    if (pluginId === 'abuseipdb') {
      return this.pluginStates().abuseipdb;
    }
    return true;
  }

  isPluginTogglePending(pluginId: string): boolean {
    return this.pendingPluginIds().has(pluginId);
  }

  isPluginIncomplete(pluginId: string): boolean {
    return !!this.getPluginIncompleteReason(pluginId);
  }

  getPluginIncompleteReason(pluginId: string): string | null {
    if (pluginId === 'ipgeolocation') {
      const ipgeo = this.settings()?.plugins?.ipgeolocation;
      if (ipgeo?.enabled && !ipgeo.api_key?.trim()) {
        return 'IPGeolocation.io is enabled but missing an API key.';
      }
    }
    if (pluginId === 'geolite') {
      const geolite = this.settings()?.plugins?.geolite;
      if (geolite?.enabled && !geolite.api_key?.trim()) {
        return 'GeoLite is enabled but missing a MaxMind license key.';
      }
    }

    if (pluginId === 'abuseipdb') {
      const abuseipdb = this.settings()?.plugins?.abuseipdb;
      if (abuseipdb?.enabled && !abuseipdb.api_key?.trim()) {
        return 'AbuseIPDB is enabled but missing an API key.';
      }
    }

    return null;
  }

  togglePlugin(pluginId: string, event: boolean): void {
    if (this.isPluginTogglePending(pluginId) || !this.settings()) {
      return;
    }

    if (pluginId !== 'geolite' && pluginId !== 'abuseipdb' && pluginId !== 'ipgeolocation') {
      return;
    }

    const previousSettings = this.settings();
    const nextEnabled = event;
    this.setPluginEnabled(pluginId, nextEnabled);
    this.setPluginPending(pluginId, true);

    const pluginsPayload = { [pluginId]: { enabled: nextEnabled } };

    this.settingsService.saveGlobalSettings({ plugins: pluginsPayload }).subscribe({
      next: () => {
        this.setPluginPending(pluginId, false);
      },
      error: (err) => {
        if (previousSettings) {
          this.settings.set(previousSettings);
        }
        this.setPluginPending(pluginId, false);
        this.notification.showError('Failed to update plugin: ' + (err?.error?.message ?? 'Unknown error'));
      }
    });
  }

  private setPluginEnabled(pluginId: string, enabled: boolean): void {
    const current = this.settings();
    if (current && pluginId === 'ipgeolocation') {
      this.settings.set({...current, plugins: {...current.plugins, ipgeolocation: {
        api_key: '', include_security: false, daily_credit_limit: 300, cache_hours: 168,
        ...current.plugins.ipgeolocation, enabled
      }}});
      return;
    }
    if (!current || (pluginId !== 'geolite' && pluginId !== 'abuseipdb')) {
      return;
    }

    const plugins = pluginId === 'geolite'
      ? {
          ...current.plugins,
          geolite: {
            ...current.plugins.geolite,
            enabled
          }
        }
      : {
          ...current.plugins,
          abuseipdb: {
            ...current.plugins.abuseipdb,
            enabled
          }
        };

    this.settings.set({
      ...current,
      plugins
    });
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
