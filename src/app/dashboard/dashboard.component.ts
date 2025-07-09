import {Component, OnInit} from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {LoadingComponent} from '../ui-elements/loading/loading.component';
import {SettingsService} from '../services/settings.service';
import {HttpService} from '../services/http.service';
import {DashboardInfo} from '../models/DashboardInfo';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {NgForOf} from '@angular/common';
import {interval, startWith, switchMap} from 'rxjs';
import {FlashOnChangeDirective} from '../ui-elements/flash-on-change/flash-on-change.directive';
import {SnackbarService} from '../services/snackbar.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatIcon,
    LoadingComponent,
    MatLabel,
    MatFormField,
    MatInput,
    NgForOf,
    FlashOnChangeDirective,
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
      error: err => SnackbarService.openSnackbarDefault("Could not get dashboard info: " + err.error.message)
    });
  }
}
