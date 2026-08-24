import { Component, signal, OnDestroy, OnInit } from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router, RouterLink} from '@angular/router';
import { filter } from 'rxjs/operators';
import { ButtonDirective } from 'primeng/button';
import { LayoutService } from '../../services/layout.service';
import {WorkspaceService} from '../../services/workspace.service';
import {NotificationService} from '../../services/notification-service.service';

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

      <span class="topbar-title">{{ title() }}</span>

      <div class="workspace-switcher" aria-label="Current workspace">
        @if (workspaces.loading() && workspaces.workspaces().length === 0) {
          <span class="workspace-switcher__loading">Loading workspace…</span>
        } @else if (workspaces.current(); as current) {
          <div class="workspace-switcher__summary">
            <span class="workspace-switcher__capacity">{{ workspaces.capacityLabel(current) }}</span>
            <span class="workspace-switcher__role">{{ current.role }}</span>
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
    </header>
  `,
  styleUrls: ['./topbar.component.scss']
})
export class TopbarComponent implements OnInit, OnDestroy {
  title = signal('Dashboard');
  private sub?: any;

  constructor(public layout: LayoutService,
              private router: Router,
              private route: ActivatedRoute,
              readonly workspaces: WorkspaceService,
              private notification: NotificationService) {}

  ngOnInit() {
    const set = () => this.title.set(this.resolveTitle(this.route));
    set();
    this.sub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(set);
    this.workspaces.load().subscribe({
      error: error => {
        const message = error?.error?.error ?? error?.message ?? 'Unknown error';
        this.notification.showError('Could not load workspaces: ' + message);
      },
    });
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

  private resolveTitle(ar: ActivatedRoute): string {
    let r = ar;
    while (r.firstChild) r = r.firstChild;
    const fromData = r.snapshot.data['title'] as string | undefined;
    if (fromData) return fromData;

    const last = this.router.url.split('/').filter(Boolean).pop() ?? 'dashboard';
    return last.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
