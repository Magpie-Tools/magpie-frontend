import {Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule, DatePipe} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {forkJoin, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {TableModule} from 'primeng/table';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {SelectModule} from 'primeng/select';

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

  private destroy$ = new Subject<void>();

  constructor(private fb: FormBuilder, private http: HttpService) {
    this.createForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(120)]],
      protocol: ['', Validators.required],
      listenPort: [null, [Validators.required, Validators.min(1025), Validators.max(65535)]],
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
          this.rotatingProxies = proxies;
          this.protocolOptions = this.buildProtocolOptions(settings);
          this.noProtocolsAvailable = this.protocolOptions.length === 0;
          if (this.noProtocolsAvailable) {
            this.createForm.get('protocol')?.disable({emitEvent: false});
            this.createForm.get('name')?.disable({emitEvent: false});
            this.createForm.get('listenPort')?.disable({emitEvent: false});
          } else {
            this.createForm.get('protocol')?.enable({emitEvent: false});
            this.createForm.get('name')?.enable({emitEvent: false});
            this.createForm.get('listenPort')?.enable({emitEvent: false});
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
      listen_port: Number(this.createForm.get('listenPort')?.value ?? 0),
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

    if (!payload.listen_port || payload.listen_port < 1025 || payload.listen_port > 65535) {
      NotificationService.showWarn('Please provide a listen port between 1025 and 65535.');
      this.createForm.get('listenPort')?.markAsTouched();
      return;
    }

    this.submitting = true;
    this.http.createRotatingProxy(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: proxy => {
          this.rotatingProxies = [proxy, ...this.rotatingProxies];
          this.submitting = false;
          this.createForm.patchValue({name: ''}, {emitEvent: false});
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
          this.rotatingProxies = this.rotatingProxies.map(item => {
            if (item.id !== proxy.id) {
              return item;
            }
            return {
              ...item,
              last_served_proxy: address,
              last_rotation_at: new Date().toISOString(),
            };
          });
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

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(address)
        .then(() => NotificationService.showSuccess('Copied to clipboard.'))
        .catch(() => NotificationService.showWarn('Could not copy to clipboard.'));
    } else {
      NotificationService.showWarn('Clipboard access is not available.');
    }
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
}
