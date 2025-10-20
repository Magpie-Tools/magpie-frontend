import {Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule, DatePipe} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {forkJoin, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {TableModule} from 'primeng/table';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {SelectModule} from 'primeng/select';
import {DialogModule} from 'primeng/dialog';

import {environment} from '../../environments/environment';

import {HttpService} from '../services/http.service';
import {NotificationService} from '../services/notification-service.service';
import {CreateRotatingProxy, RotatingProxy, RotatingProxyNext} from '../models/RotatingProxy';
import {UserSettings} from '../models/UserSettings';

type RotatingProxyPreview = RotatingProxyNext & { name: string };

@Component({
  selector: 'app-rotating-proxies',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    DatePipe,
    DialogModule,
  ],
  templateUrl: './rotating-proxies.component.html',
  styleUrl: './rotating-proxies.component.scss'
})
export class RotatingProxiesComponent implements OnInit, OnDestroy {
  createForm: FormGroup;
  rotatingProxies: RotatingProxy[] = [];
  protocolOptions: { label: string; value: string }[] = [];
  loading = false;
  submitting = false;
  rotateLoading = new Set<number>();
  preview: RotatingProxyPreview | null = null;
  noProtocolsAvailable = false;
  authEnabled = false;
  previewRotator: RotatingProxy | null = null;
  selectedRotator: RotatingProxy | null = null;
  detailsVisible = false;

  private readonly loopbackHost = '127.0.0.1';
  private readonly defaultRotatorHost = this.resolveDefaultHost();
  rotatorHost = this.loopbackHost;
  private destroy$ = new Subject<void>();

  constructor(private fb: FormBuilder, private http: HttpService) {
    this.createForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(120)]],
      protocol: ['', Validators.required],
      authRequired: [false],
      authUsername: [{value: '', disabled: true}, [Validators.maxLength(120)]],
      authPassword: [{value: '', disabled: true}, [Validators.maxLength(120)]],
    });
  }

  ngOnInit(): void {
    this.createForm.get('authRequired')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.authEnabled = !!value;
        const usernameControl = this.createForm.get('authUsername');
        const passwordControl = this.createForm.get('authPassword');
        if (this.authEnabled) {
          usernameControl?.enable({emitEvent: false});
          usernameControl?.addValidators(Validators.required);
          passwordControl?.enable({emitEvent: false});
          passwordControl?.addValidators(Validators.required);
        } else {
          usernameControl?.reset('', {emitEvent: false});
          usernameControl?.removeValidators(Validators.required);
          usernameControl?.disable({emitEvent: false});
          passwordControl?.reset('', {emitEvent: false});
          passwordControl?.removeValidators(Validators.required);
          passwordControl?.disable({emitEvent: false});
        }
        usernameControl?.updateValueAndValidity({emitEvent: false});
        passwordControl?.updateValueAndValidity({emitEvent: false});
      });

    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadInitialData(): void {
    this.loading = true;
    forkJoin({
      proxies: this.http.getRotatingProxies(),
      settings: this.http.getUserSettings(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({proxies, settings}) => {
          const rawProxies = proxies ?? [];
          const currentSelectedId = this.selectedRotator?.id ?? null;
          if (!this.rotatorHost) {
            this.rotatorHost = this.loopbackHost || this.defaultRotatorHost;
          }

          const enriched = rawProxies.map(proxy => this.enrichRotator(proxy));
          this.rotatingProxies = enriched;
          if (currentSelectedId) {
            const current = enriched.find(item => item.id === currentSelectedId) ?? null;
            this.selectedRotator = current;
            if (!current && this.detailsVisible) {
              this.detailsVisible = false;
            }
          } else if (this.selectedRotator) {
            const updated = enriched.find(item => item.id === this.selectedRotator?.id) ?? null;
            this.selectedRotator = updated;
            if (!updated && this.detailsVisible) {
              this.detailsVisible = false;
            }
          }
          if (!this.selectedRotator && this.detailsVisible) {
            this.detailsVisible = false;
          }

          this.protocolOptions = this.buildProtocolOptions(settings);
          this.noProtocolsAvailable = this.protocolOptions.length === 0;
          if (this.noProtocolsAvailable) {
            this.createForm.get('protocol')?.disable({emitEvent: false});
            this.createForm.get('name')?.disable({emitEvent: false});
          } else {
            this.createForm.get('protocol')?.enable({emitEvent: false});
            this.createForm.get('name')?.enable({emitEvent: false});
            const currentProtocol = this.createForm.get('protocol')?.value;
            if (!currentProtocol) {
              this.createForm.patchValue({protocol: this.protocolOptions[0].value}, {emitEvent: false});
            }
          }
          this.loading = false;
        },
        error: err => {
          this.loading = false;
          NotificationService.showError('Failed to load rotating proxies: ' + this.getErrorMessage(err));
        }
      });
  }

  createRotator(): void {
    if (this.createForm.invalid || this.submitting) {
      this.createForm.markAllAsTouched();
      return;
    }

    const payload: CreateRotatingProxy = {
      name: (this.createForm.get('name')?.value ?? '').trim(),
      protocol: this.createForm.get('protocol')?.value,
      auth_required: !!this.createForm.get('authRequired')?.value,
    };

    if (payload.auth_required) {
      payload.auth_username = (this.createForm.get('authUsername')?.value ?? '').trim();
      payload.auth_password = this.createForm.get('authPassword')?.value ?? '';
    }

    if (!payload.name) {
      this.createForm.get('name')?.setValue('');
      this.createForm.get('name')?.markAsTouched();
      NotificationService.showWarn('Name cannot be empty.');
      return;
    }

    this.submitting = true;
    this.http.createRotatingProxy(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: proxy => {
          const enriched = this.enrichRotator(proxy);
          if (enriched.listen_host) {
            this.rotatorHost = enriched.listen_host;
          } else if (!this.rotatorHost) {
            this.rotatorHost = this.defaultRotatorHost;
          }
          this.rotatingProxies = [enriched, ...this.rotatingProxies];
          if (this.detailsVisible) {
            this.selectedRotator = enriched;
          }
          this.submitting = false;
          this.createForm.patchValue({name: ''}, {emitEvent: false});
          this.createForm.get('authUsername')?.reset('', {emitEvent: false});
          this.createForm.get('authPassword')?.reset('', {emitEvent: false});
          NotificationService.showSuccess('Rotating proxy created.');
        },
        error: err => {
          this.submitting = false;
          NotificationService.showError('Could not create rotating proxy: ' + this.getErrorMessage(err));
        }
      });
  }

  deleteProxy(proxy: RotatingProxy): void {
    if (!proxy) {
      return;
    }

    this.http.deleteRotatingProxy(proxy.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.rotatingProxies = this.rotatingProxies.filter(item => item.id !== proxy.id);
          if (this.preview && this.preview.proxy_id === proxy.id) {
            this.preview = null;
          }
          if (this.previewRotator && this.previewRotator.id === proxy.id) {
            this.previewRotator = null;
          }
          if (this.selectedRotator && this.selectedRotator.id === proxy.id) {
            this.selectedRotator = null;
            this.detailsVisible = false;
          }
          NotificationService.showSuccess('Rotating proxy deleted.');
        },
        error: err => {
          NotificationService.showError('Could not delete rotating proxy: ' + this.getErrorMessage(err));
        }
      });
  }

  rotate(proxy: RotatingProxy): void {
    if (!proxy || this.rotateLoading.has(proxy.id)) {
      return;
    }

    this.rotateLoading.add(proxy.id);
    this.http.getNextRotatingProxy(proxy.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.rotateLoading.delete(proxy.id);
          const address = `${res.ip}:${res.port}`;
          let updatedRotator: RotatingProxy | null = null;
          this.rotatingProxies = this.rotatingProxies.map(item => {
            if (item.id !== proxy.id) {
              return item;
            }
            const enriched = this.enrichRotator({
              ...item,
              last_served_proxy: address,
              last_rotation_at: new Date().toISOString(),
            });
            updatedRotator = enriched;
            return enriched;
          });
          if (!updatedRotator) {
            updatedRotator = this.enrichRotator(proxy);
          }
          if (updatedRotator.listen_host) {
            this.rotatorHost = updatedRotator.listen_host;
          }
          this.previewRotator = updatedRotator;
          if (this.selectedRotator && this.selectedRotator.id === updatedRotator.id) {
            this.selectedRotator = updatedRotator;
          }
          this.preview = {...res, name: proxy.name};
          NotificationService.showSuccess(`Serving ${address}`);
        },
        error: err => {
          this.rotateLoading.delete(proxy.id);
          NotificationService.showError('Could not rotate proxy: ' + this.getErrorMessage(err));
        }
      });
  }

  copyPreview(preview: RotatingProxyPreview | null): void {
    if (!preview) {
      return;
    }

    const address = preview.has_auth && preview.username && preview.password
      ? `${preview.username}:${preview.password}@${preview.ip}:${preview.port}`
      : `${preview.ip}:${preview.port}`;

    this.copyValueToClipboard(address, 'Copied to clipboard.', 'No proxy available to copy yet.');
  }

  copyRotatorConnection(proxy: RotatingProxy | null): void {
    if (!proxy) {
      NotificationService.showWarn('Rotator connection is not available yet.');
      return;
    }

    const connection = this.rotatorConnectionString(proxy);
    this.copyValueToClipboard(connection, 'Rotator connection copied.', 'Rotator connection is not available yet.');
  }

  copyRotatorField(value: string | null | undefined, label: string): void {
    this.copyValueToClipboard(value ?? '', `${label} copied.`, `${label} is not set.`);
  }

  showRotatorDetails(proxy: RotatingProxy): void {
    this.selectedRotator = proxy;
    this.detailsVisible = true;
  }

  onDetailsHide(): void {
    this.detailsVisible = false;
  }

  rotatorEndpoint(proxy: RotatingProxy | null | undefined): string {
    if (!proxy) {
      return '';
    }
    const address = (proxy.listen_address ?? '').toString().trim();
    if (address) {
      return address;
    }

    const host = (proxy.listen_host ?? '').toString().trim();
    if (host) {
      return `${host}:${proxy.listen_port}`;
    }

    return `${proxy.listen_port}`;
  }

  rotatorConnectionString(proxy: RotatingProxy | null | undefined): string {
    if (!proxy) {
      return '';
    }
    const endpoint = this.rotatorEndpoint(proxy);
    if (!endpoint) {
      return '';
    }

    const protocol = (proxy.protocol ?? '').toLowerCase() || 'http';
    const needsAuth = proxy.auth_required && !!proxy.auth_username && !!proxy.auth_password;
    const credentials = needsAuth ? `${proxy.auth_username}:${proxy.auth_password}@` : '';
    return `${protocol}://${credentials}${endpoint}`;
  }

  protocolLabel(value: string): string {
    switch (value) {
      case 'http':
        return 'HTTP';
      case 'https':
        return 'HTTPS';
      case 'socks4':
        return 'SOCKS4';
      case 'socks5':
        return 'SOCKS5';
      default:
        return value?.toUpperCase() ?? '';
    }
  }

  private buildProtocolOptions(settings: UserSettings | null | undefined): { label: string; value: string }[] {
    if (!settings) {
      return [];
    }

    const options: { label: string; value: string }[] = [];
    if (settings.http_protocol) {
      options.push({label: 'HTTP', value: 'http'});
    }
    if (settings.https_protocol) {
      options.push({label: 'HTTPS', value: 'https'});
    }
    if (settings.socks4_protocol) {
      options.push({label: 'SOCKS4', value: 'socks4'});
    }
    if (settings.socks5_protocol) {
      options.push({label: 'SOCKS5', value: 'socks5'});
    }
    return options;
  }

  private getErrorMessage(err: any): string {
    return err?.error?.error ?? err?.error?.message ?? err?.message ?? 'Unknown error';
  }

  private enrichRotator(proxy: RotatingProxy): RotatingProxy {
    const listenHost = this.resolveHostValue(proxy.listen_host);
    const listenAddress = listenHost ? `${listenHost}:${proxy.listen_port}` : `${proxy.listen_port}`;

    return {
      ...proxy,
      auth_username: proxy.auth_username ?? null,
      auth_password: proxy.auth_password ?? null,
      listen_host: listenHost || null,
      listen_address: listenAddress,
    };
  }

  private resolveHostValue(host: string | null | undefined): string {
    if (this.loopbackHost) {
      return this.loopbackHost;
    }
    const candidate = (host ?? '').toString().trim();
    if (candidate) {
      return candidate;
    }
    if (this.rotatorHost) {
      return this.rotatorHost;
    }
    if (this.defaultRotatorHost) {
      return this.defaultRotatorHost;
    }
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return window.location.hostname;
    }
    return '';
  }

  private copyValueToClipboard(value: string, successMessage: string, emptyMessage: string): void {
    if (!value) {
      NotificationService.showWarn(emptyMessage);
      return;
    }

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(value)
        .then(() => NotificationService.showSuccess(successMessage))
        .catch(() => NotificationService.showWarn('Could not copy to clipboard.'));
    } else {
      NotificationService.showWarn('Clipboard access is not available.');
    }
  }

  private resolveDefaultHost(): string {
    try {
      const url = new URL(environment.apiUrl);
      if (url.hostname) {
        return url.hostname;
      }
    } catch (err) {
      // Ignore parse errors and fall back below
    }

    if (typeof window !== 'undefined' && window.location?.hostname) {
      return window.location.hostname;
    }
    return '';
  }
}
