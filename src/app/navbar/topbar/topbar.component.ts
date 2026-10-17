import {DatePipe} from '@angular/common';
import {AfterViewInit, Component, computed, DestroyRef, effect, ElementRef, inject, signal, OnDestroy, OnInit, untracked} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {NavigationEnd, Router, RouterLink} from '@angular/router';
import {HlmPopoverImports} from '@spartan-ng/helm/popover';
import { filter } from 'rxjs/operators';
import {Subscription} from 'rxjs';
import { LayoutService } from '../../services/layout.service';
import {WorkspaceService} from '../../services/workspace.service';
import {NotificationService} from '../../services/notification-service.service';
import {WorkspaceInvitationService} from '../../services/workspace-invitation.service';
import {AlertsService} from '../../services/alerts.service';
import {ReleaseNote, UpdateNotificationService} from '../../services/update-notification.service';
import {AlertIncident} from '../../models/Alert';
import {buildNotificationFeed} from './notification-feed';
import {gsap} from 'gsap';

export interface TopbarBreadcrumb {
  label: string;
  routerLink?: string;
}

const ROUTE_LABELS: Readonly<Record<string, string>> = {
  addProxies: 'Add proxies',
  abuseipdb: 'AbuseIPDB',
  geolite: 'GeoLite',
};

export function buildTopbarBreadcrumbs(url: string): TopbarBreadcrumb[] {
  const path = url.split(/[?#]/, 1)[0];
  const rawSegments = path.split('/').filter(Boolean).map(segment => segment.split(';', 1)[0]);
  if (rawSegments.length === 0) {
    return [{label: 'Dashboard'}];
  }

  return rawSegments.map((rawSegment, index) => {
    const segment = decodeURIComponent(rawSegment);
    const isProxyDetailRoot = index === 0 && segment === 'proxies' && rawSegments.length > 1;
    const label = isProxyDetailRoot ? 'Proxy' : formatRouteLabel(segment);
    const isLast = index === rawSegments.length - 1;
    return {
      label,
      ...(isLast ? {} : {routerLink: '/' + rawSegments.slice(0, index + 1).join('/')}),
    };
  });
}

function formatRouteLabel(segment: string): string {
  const configured = ROUTE_LABELS[segment];
  if (configured) {
    return configured;
  }
  return segment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/-/g, ' ')
    .replace(/^\w/, character => character.toUpperCase());
}

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, DatePipe, HlmPopoverImports],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss']
})
export class TopbarComponent implements OnInit, AfterViewInit, OnDestroy {
  breadcrumbs = signal<TopbarBreadcrumb[]>([{label: 'Dashboard'}]);
  readonly notificationsState = signal<'open' | 'closed'>('closed');
  readonly alertIncidents = signal<AlertIncident[]>([]);
  readonly releases = signal<ReleaseNote[]>([]);
  readonly alertsLoading = signal(false);
  readonly releasesLoading = signal(false);
  readonly alertsError = signal(false);
  readonly releasesError = signal(false);
  readonly recentNotifications = computed(() => buildNotificationFeed(
    this.invitations.invitations(), this.alertIncidents(), this.releases(),
  ));
  readonly notificationsLoading = computed(() =>
    this.invitations.loading() || this.alertsLoading() || this.releasesLoading());
  readonly unavailableSources = computed(() => [
    ...(this.invitations.error() ? ['invitations'] : []),
    ...(this.alertsError() ? ['alerts'] : []),
    ...(this.releasesError() ? ['releases'] : []),
  ].join(', '));
  private readonly destroyRef = inject(DestroyRef);
  private sub?: Subscription;
  private alertsRequest?: Subscription;
  private motionContext?: gsap.Context;

  constructor(public layout: LayoutService,
              private router: Router,
              readonly workspaces: WorkspaceService,
              readonly invitations: WorkspaceInvitationService,
              private notification: NotificationService,
              private elementRef: ElementRef,
              private readonly alerts: AlertsService,
              private readonly updates: UpdateNotificationService) {
    effect(() => {
      const workspaceId = this.workspaces.current()?.id;
      untracked(() => {
        this.alertsRequest?.unsubscribe();
        this.alertIncidents.set([]);
        this.alertsLoading.set(false);
        this.alertsError.set(false);
        if (workspaceId) this.loadAlerts();
      });
    });
  }

  ngOnInit() {
    const set = () => this.breadcrumbs.set(buildTopbarBreadcrumbs(this.router.url));
    set();
    this.sub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      set();
      this.notificationsState.set('closed');
    });
    this.workspaces.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      error: error => {
        const message = error?.error?.error ?? error?.message ?? 'Unknown error';
        this.notification.showError('Could not load workspaces: ' + message);
      },
    });
    this.refreshNotifications(false);
  }

  ngAfterViewInit(): void {
    if (typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.motionContext = gsap.context(() => {
        gsap.from('.topbar__navigation', {opacity: 0, y: -7, duration: 0.42, ease: 'power2.out'});
        gsap.from('.topbar-actions > *', {
          opacity: 0,
          duration: 0.4,
          delay: 0.08,
          stagger: 0.06,
          ease: 'power2.out',
        });
      }, this.elementRef.nativeElement);
    }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe?.();
    this.motionContext?.revert();
  }

  onNotificationsStateChange(state: 'open' | 'closed'): void {
    this.notificationsState.set(state);
    if (state === 'open') this.refreshNotifications();
  }

  refreshNotifications(refreshAlerts = true): void {
    if (!this.invitations.loading()) {
      this.invitations.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({error: () => undefined});
    }
    if (!this.releasesLoading()) {
      this.releasesLoading.set(true);
      this.releasesError.set(false);
      this.updates.fetchReleaseFeed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: feed => {
          this.releases.set(feed.releases);
          this.releasesLoading.set(false);
        },
        error: () => {
          this.releasesError.set(true);
          this.releasesLoading.set(false);
        },
      });
    }
    if (refreshAlerts && this.workspaces.current() && !this.alertsLoading()) this.loadAlerts();
  }

  private loadAlerts(): void {
    this.alertsRequest?.unsubscribe();
    this.alertsLoading.set(true);
    this.alertsError.set(false);
    this.alertsRequest = this.alerts.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: page => {
        this.alertIncidents.set(page.incidents);
        this.alertsLoading.set(false);
      },
      error: () => {
        this.alertsError.set(true);
        this.alertsLoading.set(false);
      },
    });
  }

  onWorkspaceChange(event: Event): void {
    const workspaceId = Number((event.target as HTMLSelectElement | null)?.value);
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return;
    }
    this.workspaces.switchTo(workspaceId).subscribe({
      error: error => {
        const message = error?.error?.error ?? error?.message ?? 'Unknown error';
        this.notification.showError('Could not switch workspace: ' + message);
      },
    });
  }

}
