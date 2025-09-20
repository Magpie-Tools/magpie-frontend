import { Component, signal, OnDestroy, OnInit } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ButtonDirective } from 'primeng/button';
import { LayoutService } from '../../services/layout.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [ButtonDirective],
  template: `
    <header class="topbar">
      <button pButton type="button" icon="pi pi-bars"
              class="p-button-text p-button-plain mr-2"
              aria-label="Toggle sidebar"
              (click)="layout.toggleSidebar()"></button>

      <span class="topbar-title">{{ title() }}</span>
    </header>
  `,
  styleUrls: ['./topbar.component.scss']
})
export class TopbarComponent implements OnInit, OnDestroy {
  title = signal('Dashboard');
  private sub?: any;

  constructor(public layout: LayoutService,
              private router: Router,
              private route: ActivatedRoute) {}

  ngOnInit() {
    const set = () => this.title.set(this.resolveTitle(this.route));
    set();
    this.sub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(set);
  }

  ngOnDestroy() { this.sub?.unsubscribe?.(); }

  private resolveTitle(ar: ActivatedRoute): string {
    let r = ar;
    while (r.firstChild) r = r.firstChild;
    const fromData = r.snapshot.data['title'] as string | undefined;
    if (fromData) return fromData;

    const last = this.router.url.split('/').filter(Boolean).pop() ?? 'dashboard';
    return last.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
