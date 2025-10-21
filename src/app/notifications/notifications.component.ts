import {Component, inject} from '@angular/core';
import {NgIf} from '@angular/common';
import {VersionService} from '../services/version.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [NgIf],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent {
  private readonly versionService = inject(VersionService);
  readonly updateAvailable = this.versionService.hasUpdate;
  readonly latestVersion = this.versionService.availableVersion;

  reload() {
    this.versionService.acknowledgeUpdate();
    window.location.reload();
  }
}
