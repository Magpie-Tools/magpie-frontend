import {HlmToaster} from '@spartan-ng/helm/sonner';
import {afterNextRender, Component, DestroyRef, effect, ElementRef, inject, Injector, untracked} from '@angular/core';
import {BreakpointObserver} from '@angular/cdk/layout';
import {takeUntilDestroyed, toSignal} from '@angular/core/rxjs-interop';
import {NavigationEnd, Router, RouterOutlet} from '@angular/router';
import {filter, map} from 'rxjs/operators';
import { NavbarComponent } from './navbar/navbar.component';
import { UserService } from './services/authorization/user.service';

import {LayoutService} from './services/layout.service';
import {TopbarComponent} from './navbar/topbar/topbar.component';
import {LoadingComponent} from './ui-elements/loading/loading.component';
import {NotificationReadScopeDirective} from './shared/notification-read-scope.directive';

export const MOBILE_LAYOUT_QUERY = '(max-width: 48rem)';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HlmToaster, RouterOutlet, NavbarComponent, TopbarComponent, LoadingComponent, NotificationReadScopeDirective],
  host: {
    '(document:keydown.escape)': 'closeDrawerFromKeyboard($event)',
  },
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  layout = inject(LayoutService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  protected readonly isMobile = toSignal(
    inject(BreakpointObserver).observe(MOBILE_LAYOUT_QUERY).pipe(map(result => result.matches)),
    {initialValue: typeof window !== 'undefined' && window.innerWidth <= 768},
  );
  private drawerWasOpen = false;

  constructor() {
    // Constructing UserService initializes the session before the router view is shown.
    inject(UserService);

    // Menus opened from the modal drawer (the account menu) render in an overlay outside it.
    // Tab closes such a menu and returns focus to its trigger; keep focus there instead of
    // letting the browser move past the drawer's last control to <body>.
    const keepMenuFocusInDrawer = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === 'Tab' && this.workspaceInert() && target?.closest?.('.cdk-overlay-container [role="menu"]')) {
        event.preventDefault();
      }
    };
    document.addEventListener('keydown', keepMenuFocusInDrawer, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('keydown', keepMenuFocusInDrawer, true));

    // The mobile drawer covers the page, so close it once the user picks a destination.
    inject(Router).events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => {
      if (this.isMobile() && this.layout.sidebarOpen()) {
        this.layout.setSidebar(false);
      }
    });

    // Crossing the phone breakpoint resets the sidebar to that layout's default (closed on phones,
    // open on desktop) so a resize never turns an open sidebar into a modal drawer. Registered
    // before the focus effect so that effect sees the reset state.
    let wasMobile = this.isMobile();
    effect(() => {
      const mobile = this.isMobile();
      untracked(() => {
        if (mobile !== wasMobile) {
          wasMobile = mobile;
          this.layout.setSidebar(!mobile);
        }
      });
    });

    effect(() => {
      const drawerOpen = this.isMobile() && this.layout.sidebarOpen();
      untracked(() => this.moveDrawerFocus(drawerOpen));
    });
  }

  /** The workspace becomes inert while the mobile drawer is open, which keeps focus inside the drawer. */
  protected workspaceInert(): boolean {
    return this.isMobile() && this.layout.sidebarOpen();
  }

  protected focusMain(event: Event): void {
    event.preventDefault();
    (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('#main-content')?.focus();
  }

  /** Wraps Tab and Shift+Tab inside the open mobile drawer. */
  protected trapDrawerFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.workspaceInert()) {
      return;
    }
    const drawer = event.currentTarget as HTMLElement;
    const focusable = Array.from(drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), summary'))
      .filter(element => element.offsetParent !== null);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  closeDrawerFromKeyboard(event?: Event): void {
    // A menu or dialog inside the drawer handles its own Escape first; leave the drawer open.
    const target = event?.target as HTMLElement | null;
    if (event?.defaultPrevented || target?.closest?.('.cdk-overlay-container')) {
      return;
    }
    if (this.isMobile() && this.layout.sidebarOpen()) {
      this.layout.setSidebar(false);
    }
  }

  private moveDrawerFocus(drawerOpen: boolean): void {
    if (drawerOpen === this.drawerWasOpen) {
      return;
    }
    this.drawerWasOpen = drawerOpen;
    afterNextRender(() => {
      const root = this.host.nativeElement as HTMLElement;
      const target = drawerOpen
        ? root.querySelector<HTMLElement>('app-navbar a[href], app-navbar button')
        : root.querySelector<HTMLElement>('.topbar-menu-button');
      target?.focus();
    }, {injector: this.injector});
  }

  protected readonly UserService = UserService;
}
