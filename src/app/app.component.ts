import {Component, inject} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { UserService } from './services/authorization/user.service';
import {NotificationService} from './services/notification-service.service';
import {Toast} from 'primeng/toast';
import {LayoutService} from './services/layout.service';
import {ThemeService} from './services/theme.service';
import {TopbarComponent} from './navbar/topbar/topbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, Toast, TopbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Magpie';
  layout = inject(LayoutService);
  private readonly _theme = inject(ThemeService);

  constructor(
    private notificationService: NotificationService
  ) {}

  protected readonly UserService = UserService;
}
