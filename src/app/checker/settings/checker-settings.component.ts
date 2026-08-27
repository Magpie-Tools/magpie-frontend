import {AfterViewInit, Component, ElementRef, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {CheckboxComponent} from '../../checkbox/checkbox.component';
import {InputText} from 'primeng/inputtext';
import {Button} from 'primeng/button';
import {Select} from 'primeng/select';
import {Chip} from 'primeng/chip';
import {PrimeTemplate} from 'primeng/api';
import {SettingsService} from '../../services/settings.service';
import {NotificationService} from '../../services/notification-service.service';
import {UserSettings} from '../../models/UserSettings';
import {Subject} from 'rxjs';
import {filter, takeUntil} from 'rxjs/operators';
import {TooltipComponent} from '../../tooltip/tooltip.component';
import {WorkspaceService} from '../../services/workspace.service';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-checker-settings',
  standalone: true,
  imports: [ReactiveFormsModule, CheckboxComponent, InputText, Button, Select, Chip, PrimeTemplate, TooltipComponent],
  templateUrl: './checker-settings.component.html',
  styleUrls: ['./checker-settings.component.scss']
})
export class CheckerSettingsComponent implements OnInit, AfterViewInit, OnDestroy {
  settingsForm: FormGroup;
  readonly protocolOptions = [
    {
      label: 'HTTP',
      control: 'HTTPProtocol',
      icon: 'pi pi-globe',
      description: 'Standard web proxies',
    },
    {
      label: 'HTTPS',
      control: 'HTTPSProtocol',
      icon: 'pi pi-lock',
      description: 'Encrypted web traffic',
    },
    {
      label: 'SOCKS4',
      control: 'SOCKS4Protocol',
      icon: 'pi pi-sitemap',
      description: 'IPv4 socket routing',
    },
    {
      label: 'SOCKS5',
      control: 'SOCKS5Protocol',
      icon: 'pi pi-shield',
      description: 'Modern socket routing',
    },
  ];
  transportProtocolOptions = [
    { label: 'TCP', value: 'tcp' },
    { label: 'QUIC', value: 'quic' },
    { label: 'HTTP/3', value: 'http3' },
  ];
  readonly transportProtocolTooltip =
    'TCP uses standard HTTP over TCP. QUIC and HTTP/3 both use HTTP/3 over QUIC; QUIC enables HTTP/3 datagrams (unreliable messages), HTTP/3 uses streams only.';
  private destroy$ = new Subject<void>();
  private animationContext?: gsap.Context;

  constructor(
    private fb: FormBuilder,
    private settingsService: SettingsService,
    private notification: NotificationService,
    private elementRef: ElementRef<HTMLElement>,
    readonly workspaces: WorkspaceService,
  ) {
    this.settingsForm = this.createForm();
    this.configureAutoRemoveThresholdToggle();
  }

  ngOnInit(): void {
    this.populateForm(this.settingsService.getUserSettings());

    this.settingsService.userSettings$
      .pipe(
        filter((settings): settings is UserSettings => !!settings),
        takeUntil(this.destroy$)
      )
      .subscribe(settings => this.populateForm(settings));
  }

  ngAfterViewInit(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const host = this.elementRef.nativeElement;
    const scrollContainer = host.closest('main') as HTMLElement | null;
    const scroller = scrollContainer ?? undefined;

    this.animationContext = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.settings-card').forEach((card, index) => {
        gsap.from(card, {
          opacity: 0,
          y: 28,
          scale: 0.985,
          duration: 0.7,
          delay: index * 0.04,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            scroller,
            start: 'top 94%',
            toggleActions: 'play none none reverse',
          },
        });
      });
    }, host);

    requestAnimationFrame(() => ScrollTrigger.refresh());
  }

  ngOnDestroy(): void {
    this.animationContext?.revert();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get selectedProtocolCount(): number {
    return this.protocolOptions.filter(option => !!this.settingsForm.get(option.control)?.value).length;
  }

  get totalAttempts(): number {
    const retries = Number(this.settingsForm.get('Retries')?.value ?? 0);
    return Math.max(1, Math.round(Number.isFinite(retries) ? retries : 0) + 1);
  }

  get configuredAttemptWindow(): string {
    const timeout = Number(this.settingsForm.get('Timeout')?.value ?? 0);
    const totalMilliseconds = Math.max(0, Number.isFinite(timeout) ? timeout : 0) * this.totalAttempts;

    if (totalMilliseconds < 1000) {
      return `${Math.round(totalMilliseconds)} ms`;
    }

    const seconds = totalMilliseconds / 1000;
    if (seconds < 60) {
      return `${Number(seconds.toFixed(seconds >= 10 ? 0 : 1))} sec`;
    }

    const minutes = seconds / 60;
    return `${Number(minutes.toFixed(1))} min`;
  }

  get cleanupThreshold(): number {
    const threshold = Number(this.settingsForm.get('AutoRemoveFailureThreshold')?.value ?? 1);
    return Math.min(Math.max(Math.round(Number.isFinite(threshold) ? threshold : 1), 1), 255);
  }

  toggleProtocol(controlName: string): void {
    if (!this.workspaces.canOperate()) {
      return;
    }

    const control = this.settingsForm.get(controlName);
    if (!control) {
      return;
    }

    control.setValue(!control.value);
    control.markAsDirty();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      HTTPProtocol: [false],
      HTTPSProtocol: [true],
      SOCKS4Protocol: [false],
      SOCKS5Protocol: [false],
      Timeout: [7500],
      Retries: [2],
      UseHttpsForSocks: [true],
      TransportProtocol: ['tcp'],
      AutoRemoveFailingProxies: [false],
      AutoRemoveFailureThreshold: [3, [Validators.min(1), Validators.max(255)]],
    });
  }

  private populateForm(settings: UserSettings | undefined): void {
    if (!settings) {
      return;
    }

    const transportValues = this.transportProtocolOptions.map(option => option.value);
    const selectedTransport = transportValues.includes(settings.transport_protocol)
      ? settings.transport_protocol
      : 'tcp';

    this.settingsForm.patchValue({
      HTTPProtocol: settings.http_protocol,
      HTTPSProtocol: settings.https_protocol,
      SOCKS4Protocol: settings.socks4_protocol,
      SOCKS5Protocol: settings.socks5_protocol,
      Timeout: settings.timeout,
      Retries: settings.retries,
      UseHttpsForSocks: settings.UseHttpsForSocks,
      TransportProtocol: selectedTransport,
      AutoRemoveFailingProxies: settings.auto_remove_failing_proxies,
      AutoRemoveFailureThreshold: settings.auto_remove_failure_threshold,
    });

    this.settingsForm.markAsPristine();
  }

  onSubmit(): void {
    if (!this.workspaces.canOperate()) {
      return;
    }
    const current = this.settingsService.getUserSettings();
    const payload = {
      ...this.settingsForm.getRawValue(),
      judges: current?.judges ?? [],
    };

    const threshold = Number(payload.AutoRemoveFailureThreshold ?? 1);
    const normalizedThreshold = Math.round(Number.isFinite(threshold) ? threshold : 1);
    payload.AutoRemoveFailureThreshold = Math.min(Math.max(normalizedThreshold, 1), 255);

    this.settingsService.saveUserSettings(payload).subscribe({
      next: (resp) => {
        this.notification.showSuccess(resp.message);
        this.populateForm(this.settingsService.getUserSettings());
      },
      error: (err) => {
        console.error('Error saving settings:', err);
        const reason = err?.error?.message ?? err?.error?.error ?? 'Failed to save settings!';
        this.notification.showError(reason);
      }
    });
  }

  private configureAutoRemoveThresholdToggle(): void {
    const autoRemoveControl = this.settingsForm.get('AutoRemoveFailingProxies');
    const thresholdControl = this.settingsForm.get('AutoRemoveFailureThreshold');

    if (!autoRemoveControl || !thresholdControl) {
      return;
    }

    const syncThresholdState = (isEnabled: boolean): void => {
      if (isEnabled) {
        thresholdControl.enable({emitEvent: false});
      } else {
        thresholdControl.disable({emitEvent: false});
      }
    };

    syncThresholdState(!!autoRemoveControl.value);

    autoRemoveControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => syncThresholdState(!!value));
  }
}
