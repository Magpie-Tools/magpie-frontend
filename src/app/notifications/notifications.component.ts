import {Component, OnInit, inject} from '@angular/core';
import {NgIf} from '@angular/common';
import {UpdateNotificationService} from '../services/update-notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [NgIf],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent implements OnInit {
  private readonly updateService = inject(UpdateNotificationService);

  readonly updateAvailable = this.updateService.hasUpdate;
  readonly remoteCommit = this.updateService.latestRemoteCommit;
  readonly localCommit = this.updateService.localCommit;

  ngOnInit() {
    this.updateService.start();
  }

  viewLatestCommit() {
    this.updateService.openLatestCommit();
  }
}
