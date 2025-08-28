import {Component} from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {UserService} from "../services/authorization/user.service";
import {Button, ButtonDirective} from 'primeng/button';
import {Popover} from 'primeng/popover';

@Component({
    selector: 'app-navbar',
  imports: [
    RouterLink,
    RouterLinkActive,
    ButtonDirective,
    Popover,
    Button,
  ],
    templateUrl: './navbar.component.html',
    styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
    protected readonly UserService = UserService;

    constructor(protected user: UserService) {
    }
}
