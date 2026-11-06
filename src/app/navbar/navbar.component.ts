import {HlmDropdownMenuImports} from '@spartan-ng/helm/dropdown-menu';
import {AfterViewInit, Component, ElementRef, inject, OnDestroy, OnInit} from '@angular/core';
import {BreakpointObserver} from '@angular/cdk/layout';
import {toSignal} from '@angular/core/rxjs-interop';
import {map} from 'rxjs/operators';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideChevronsUpDown} from '@ng-icons/lucide';
import {Router, RouterLink, RouterLinkActive} from '@angular/router';
import {UserService} from "../services/authorization/user.service";

import {gsap} from 'gsap';

@Component({
  selector: 'app-navbar',
  imports: [HlmDropdownMenuImports, NgIcon,
    RouterLink,
    RouterLinkActive,

  ],
  providers: [provideIcons({lucideChevronsUpDown})],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly isMobile = toSignal(
    inject(BreakpointObserver).observe('(max-width: 768px)').pipe(map(result => result.matches)),
    {initialValue: false},
  );
  menuItems: NavigationItem[] = [];
  private adminRefreshTimer?: ReturnType<typeof setTimeout>;
  private motionContext?: gsap.Context;

  private readonly router = inject(Router);

  constructor(protected user: UserService,
              private elementRef: ElementRef) {}

  /** Expand a group while one of its pages is open, so the sidebar always shows the current location. */
  isGroupActive(group: NavigationItem): boolean {
    return (group.items ?? []).some(item => !!item.routerLink && this.router.isActive(item.routerLink, {
      paths: 'subset', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored',
    }));
  }

  ngOnInit() {
    this.updateNavigationItems();

    this.adminRefreshTimer = setTimeout(() => this.updateNavigationItems(), 1000);
  }

  updateNavigationItems(): void {
    this.menuItems = [
      {
        label: 'Checker',
        icon: 'icon icon-wrench',
        styleClass: 'menu-title',
        hasExpandable: true,
        expanded: true,
        items: [
          {
            label: 'Settings',
            icon: 'icon icon-settings',
            routerLink: '/checker/settings',
          },
          {
            label: 'Judges',
            icon: 'icon icon-contact-round',
            routerLink: '/checker/judges'
          }
        ]
      },
      {
        label: 'Admin',
        icon: 'icon icon-shield',
        styleClass: 'menu-title',
        hasExpandable: true,
        visible: UserService.isAdmin(),
        items: [
          {
            label: 'Global checker',
            icon: 'icon icon-sliders-horizontal',
            routerLink: '/global/checker'
          },
          {
            label: 'Global scraper',
            icon: 'icon icon-cloud-download',
            routerLink: '/global/scraper'
          },
          {
            label: 'Global blacklist',
            icon: 'icon icon-ban',
            routerLink: '/global/blacklist'
          },
          {
            label: 'Plugins',
            icon: 'icon icon-archive',
            routerLink: '/plugins'
          }
        ]
      }
    ];
  }

  ngAfterViewInit() {
    if (typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.motionContext = gsap.context(() => {
        gsap.from('.navbar-brand__mark', {opacity: 0, scale: 0.82, duration: 0.55, ease: 'power3.out'});
        gsap.from('.navbar-brand__copy', {opacity: 0, x: -8, duration: 0.5, delay: 0.08, ease: 'power3.out'});
        gsap.from('.nav-section, .nav-cluster', {
          opacity: 0,
          y: 10,
          duration: 0.42,
          delay: 0.12,
          stagger: 0.055,
          ease: 'power2.out',
        });
        gsap.from('.account-section', {opacity: 0, y: 8, duration: 0.45, delay: 0.3, ease: 'power2.out'});
      }, this.elementRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    if (this.adminRefreshTimer) {
      clearTimeout(this.adminRefreshTimer);
    }
    this.motionContext?.revert();
  }
}

interface NavigationItem { label: string; icon: string; styleClass?: string; hasExpandable?: boolean; expanded?: boolean; visible?: boolean; routerLink?: string; items?: NavigationItem[]; }
