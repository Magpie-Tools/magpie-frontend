import {AfterViewInit, Component, ElementRef, signal, OnDestroy, OnInit} from '@angular/core';
import {NavigationEnd, Router, RouterLink} from '@angular/router';
import { filter } from 'rxjs/operators';
import {Subscription} from 'rxjs';
import { LayoutService } from '../../services/layout.service';
import {WorkspaceService} from '../../services/workspace.service';
import {NotificationService} from '../../services/notification-service.service';
import {WorkspaceInvitationService} from '../../services/workspace-invitation.service';
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
  imports: [RouterLink],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss']
})
export class TopbarComponent implements OnInit, AfterViewInit, OnDestroy {
  breadcrumbs = signal<TopbarBreadcrumb[]>([{label: 'Dashboard'}]);
  private sub?: Subscription;
  private motionContext?: gsap.Context;

  constructor(public layout: LayoutService,
              private router: Router,
              readonly workspaces: WorkspaceService,
              readonly invitations: WorkspaceInvitationService,
              private notification: NotificationService,
              private elementRef: ElementRef) {}

  ngOnInit() {
    const set = () => this.breadcrumbs.set(buildTopbarBreadcrumbs(this.router.url));
    set();
    this.sub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(set);
    this.workspaces.load().subscribe({
      error: error => {
        const message = error?.error?.error ?? error?.message ?? 'Unknown error';
        this.notification.showError('Could not load workspaces: ' + message);
      },
    });
    this.invitations.load().subscribe({error: () => undefined});
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
