import {Component, OnInit} from '@angular/core';
import {LoadingComponent} from '../ui-elements/loading/loading.component';
import {SettingsService} from '../services/settings.service';
import {HttpService} from '../services/http.service';
import {DashboardInfo} from '../models/DashboardInfo';

import {interval, startWith, switchMap} from 'rxjs';
import {NotificationService} from '../services/notification-service.service';

@Component({
    selector: 'app-dashboard',
    imports: [
    LoadingComponent,
],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit{
  dashboardInfo: DashboardInfo | undefined;

  constructor(private settings: SettingsService, private http: HttpService) {
    settings.loadSettings()
  }

  ngOnInit(): void {
    interval(10_000).pipe(
      startWith(0),
      switchMap(() => this.http.getDashboardInfo())
    ).subscribe({
      next: info => this.dashboardInfo = info,
      error: err => NotificationService.showError("Could not get dashboard info: " + err.error.message)
    });
  }
}
