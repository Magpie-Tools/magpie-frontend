import {AfterViewInit, Component, ElementRef, OnDestroy, OnInit} from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {UserService} from "../services/authorization/user.service";
import {Popover} from 'primeng/popover';
import {MenuItem} from 'primeng/api';
import {ThemeService} from '../services/theme.service';
import {gsap} from 'gsap';

@Component({
  selector: 'app-navbar',
  imports: [
    RouterLink,
    RouterLinkActive,
    Popover,
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, AfterViewInit, OnDestroy {
  menuItems: MenuItem[] = [];
  private adminRefreshTimer?: ReturnType<typeof setTimeout>;
  private motionContext?: gsap.Context;

  constructor(protected user: UserService,
              private elementRef: ElementRef,
              protected themeService: ThemeService,) {}

  ngOnInit() {
    this.updateMenuItems();

    this.adminRefreshTimer = setTimeout(() => this.updateMenuItems(), 1000);
  }

  updateMenuItems(): void {
    this.menuItems = [
      {
        label: 'Checker',
        icon: 'pi pi-wrench',
        styleClass: 'menu-title',
        hasExpandable: true,
        expanded: true,
        items: [
          {
            label: 'Settings',
            icon: 'pi pi-cog',
            routerLink: '/checker/settings',
          },
          {
            label: 'Judges',
            icon: 'pi pi-address-book',
            routerLink: '/checker/judges'
          }
        ]
      },
      {
        label: 'Admin',
        icon: 'pi pi-shield',
        styleClass: 'menu-title',
        hasExpandable: true,
        visible: UserService.isAdmin(),
        items: [
          {
            label: 'Global Checker',
            icon: 'pi pi-sliders-h',
            routerLink: '/global/checker'
          },
          {
            label: 'Global Scraper',
            icon: 'pi pi-cloud-download',
            routerLink: '/global/scraper'
          },
          {
            label: 'Global Blacklist',
            icon: 'pi pi-ban',
            routerLink: '/global/blacklist'
          },
          {
            label: 'Plugins',
            icon: 'pi pi-box',
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

  protected getSrcPath() {
    const start = "/assets/logo/magpie-light-";
    if (this.themeService.theme() === 'purple') {
      return start + "purple.svg";
    } else if (this.themeService.theme() === 'blue') {
      return start + "blue.svg";
    } else if (this.themeService.theme() === 'red') {
      return start + "red.svg";
    }
    return start + 'green.svg';
  }
}
