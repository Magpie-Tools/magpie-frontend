import { Component, signal, OnDestroy, OnInit } from '@angular/core';
import {NavigationEnd, Router, RouterLink} from '@angular/router';
import { filter } from 'rxjs/operators';
import {Subscription} from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { LayoutService } from '../../services/layout.service';
import {WorkspaceService} from '../../services/workspace.service';
import {NotificationService} from '../../services/notification-service.service';
import {WorkspaceInvitationService} from '../../services/workspace-invitation.service';

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
  imports: [ButtonDirective, RouterLink],
  template: `
    <header class="topbar">
      <button pButton type="button" icon="pi pi-bars"
              class="p-button-text p-button-plain mr-2"
              aria-label="Toggle sidebar"
              (click)="layout.toggleSidebar()"></button>

      <nav class="topbar-breadcrumb" aria-label="Page breadcrumb">
        @for (item of breadcrumbs(); track $index; let last = $last) {
          @if (item.routerLink && !last) {
            <a class="topbar-breadcrumb__link" [routerLink]="item.routerLink">{{ item.label }}</a>
          } @else {
            <span class="topbar-breadcrumb__current" [attr.aria-current]="last ? 'page' : null">{{ item.label }}</span>
          }
          @if (!last) {
            <span class="topbar-breadcrumb__separator" aria-hidden="true">/</span>
          }
        }
      </nav>

      <div class="topbar-actions">
        <a
          routerLink="/invitations"
          class="invitation-link"
          [attr.aria-label]="'Workspace invitations, ' + invitations.pendingCount() + ' pending'"
          title="Workspace invitations"
        >
          <i class="pi pi-inbox" aria-hidden="true"></i>
          @if (invitations.pendingCount() > 0) {
            <span class="invitation-link__count">{{ invitations.pendingCount() > 99 ? '99+' : invitations.pendingCount() }}</span>
          }
        </a>

        <div class="workspace-switcher" aria-label="Current workspace">
          @if (workspaces.loading() && workspaces.workspaces().length === 0) {
            <span class="workspace-switcher__loading">Loading workspace…</span>
          } @else if (workspaces.current(); as current) {
            <div class="workspace-switcher__summary">
              <span class="workspace-switcher__capacity">{{ workspaces.capacityLabel(current) }}</span>
            </div>
            <label class="sr-only" for="workspace-select">Workspace</label>
            <select
              id="workspace-select"
              class="workspace-switcher__select"
              [value]="current.id"
              (change)="onWorkspaceChange($event)"
            >
              @for (workspace of workspaces.workspaces(); track workspace.id) {
                <option [value]="workspace.id">{{ workspace.name }}</option>
              }
            </select>
            <a
              routerLink="/workspace"
              class="workspace-switcher__settings"
              aria-label="Workspace settings"
              title="Workspace settings"
            >
              <i class="pi pi-cog" aria-hidden="true"></i>
            </a>
          }
        </div>
      </div>
    </header>
  `,
  styleUrls: ['./topbar.component.scss']
})
export class TopbarComponent implements OnInit, OnDestroy {
  breadcrumbs = signal<TopbarBreadcrumb[]>([{label: 'Dashboard'}]);
  private sub?: Subscription;

  constructor(public layout: LayoutService,
              private router: Router,
              readonly workspaces: WorkspaceService,
              readonly invitations: WorkspaceInvitationService,
              private notification: NotificationService) {}

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

  ngOnDestroy() { this.sub?.unsubscribe?.(); }

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
