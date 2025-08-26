import {Component} from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {UserService} from "../services/authorization/user.service";
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';
import {MatButton} from '@angular/material/button';

@Component({
    selector: 'app-navbar',
    imports: [
        MatIcon,
        RouterLink,
        RouterLinkActive,
        MatMenuTrigger,
        MatMenu,
        MatMenuItem,
        MatButton,
        RouterOutlet,
    ],
    templateUrl: './navbar.component.html',
    styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
    protected readonly UserService = UserService;

    constructor(protected user: UserService) {
    }
}
