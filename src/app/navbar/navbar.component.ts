import {Component} from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {UserService} from "../services/authorization/user.service";

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    MatIcon,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
    protected readonly UserService = UserService;
}
