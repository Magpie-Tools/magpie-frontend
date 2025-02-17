import { Component } from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {MatDivider} from '@angular/material/divider';
import {TooltipComponent} from '../tooltip/tooltip.component';
import {LoadingComponent} from '../ui-elements/loading/loading.component';
import {StarBackgroundComponent} from '../ui-elements/star-background/star-background.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatIcon,
    MatDivider,
    TooltipComponent,
    LoadingComponent,
    StarBackgroundComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
}
