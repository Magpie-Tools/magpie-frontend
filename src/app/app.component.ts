import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { UserService } from './services/authorization/user.service';
import {NotificationService} from './services/notification-service.service';
import {Toast} from 'primeng/toast';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, Toast],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Magpie';

  constructor(
    private notificationService: NotificationService
  ) {

  }

  protected readonly UserService = UserService;
}
