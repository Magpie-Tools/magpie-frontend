import {Component, inject} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { UserService } from './services/authorization/user.service';
import {NotificationService} from './services/notification-service.service';
import {Toast} from 'primeng/toast';
import {LayoutService} from './services/layout.service';
import {TopbarComponent} from './navbar/topbar/topbar.component';
import {LoadingComponent} from './ui-elements/loading/loading.component';
import {UpdateNotificationService} from './services/update-notification.service';
import {NotificationsComponent} from './notifications/notifications.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, Toast, TopbarComponent, LoadingComponent, NotificationsComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Magpie';
  layout = inject(LayoutService);
  private readonly updateNotificationService = inject(UpdateNotificationService);

  constructor(
    private notificationService: NotificationService
  ) {
    this.updateNotificationService.start();
  }

  protected readonly UserService = UserService;
}
