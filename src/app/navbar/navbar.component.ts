import {AfterViewInit, Component, ElementRef, OnInit} from '@angular/core';
import {NavigationEnd, Router, RouterLink, RouterLinkActive} from '@angular/router';
import {UserService} from "../services/authorization/user.service";
import {Button, ButtonDirective} from 'primeng/button';
import {Popover} from 'primeng/popover';
import {PanelMenu} from 'primeng/panelmenu';
import {MenuItem} from 'primeng/api';
import {Ripple} from 'primeng/ripple';
import {Badge} from 'primeng/badge';

@Component({
  selector: 'app-navbar',
  imports: [
    RouterLink,
    RouterLinkActive,
    ButtonDirective,
    Popover,
    Button,
    PanelMenu,
    Ripple,
    Badge,
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, AfterViewInit {
  menuItems: MenuItem[] = [];

  constructor(protected user: UserService,
              private router: Router,
              private elementRef: ElementRef) {}

  ngOnInit() {
    this.updateMenuItems();

    setTimeout(() => this.updateMenuItems(), 1000); //Because of admin
  }

  updateMenuItems(): void {
    this.menuItems = [
      {
        label: 'Tools',
        icon: 'pi pi-wrench', // Add icon for the header
        styleClass: 'menu-title',
        hasExpandable: true,
        expanded: true,
        items: [
          {
            label: 'Checker',
            icon: 'pi pi-check-circle',
            routerLink: 'checker',
          },
          {
            label: 'Scraper',
            icon: 'pi pi-download',
            routerLink: 'scraper'
          }
        ]
      },
      {
        label: 'Admin',
        icon: 'pi pi-shield', // Add icon for the header
        styleClass: 'menu-title',
        hasExpandable: true,
        visible: UserService.isAdmin(),
        items: [
          {
            label: 'Global Checker',
            icon: 'pi pi-globe',
            routerLink: 'global/checker'
          },
          {
            label: 'Global Scraper',
            icon: 'pi pi-globe',
            routerLink: 'global/scraper'
          }
        ]
      }
    ];
  }

  ngAfterViewInit() {
    //FIXES FIREFOX SELECTION BUG
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        setTimeout(() => {
          this.removeFocusFromPanelMenu();
        }, 100);
      }
    });

    // Listen to panel menu clicks to handle toggle events
    const panelMenuElement = this.elementRef.nativeElement.querySelector('p-panelmenu');
    if (panelMenuElement) {
      panelMenuElement.addEventListener('click', (event: any) => {
        // Check if a header was clicked (toggle action)
        if (event.target.closest('.p-panelmenu-header')) {
          setTimeout(() => {
            this.removeFocusFromPanelMenu();
          }, 150); // Slightly longer delay for panel animation
        }
      });
    }
  }

  private removeFocusFromPanelMenu(): void {
    const focusedElements = this.elementRef.nativeElement.querySelectorAll('.p-focus');
    focusedElements.forEach((element: HTMLElement) => {
      element.classList.remove('p-focus');
      element.blur();
    });
  }
}
