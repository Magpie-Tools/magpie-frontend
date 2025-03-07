import { Component } from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {LoadingComponent} from '../ui-elements/loading/loading.component';
import {SettingsService} from '../services/settings.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatIcon,
    LoadingComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {

  constructor(private settings: SettingsService) {
  }
}
