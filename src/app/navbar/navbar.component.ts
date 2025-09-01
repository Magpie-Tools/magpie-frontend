import {Component, OnInit} from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';
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
export class NavbarComponent implements OnInit {
  menuItems: MenuItem[] = [];

  constructor(protected user: UserService) {}

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
}
