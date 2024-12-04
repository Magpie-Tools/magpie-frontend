import { Component } from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {LoadingComponent} from '../loading/loading.component';
import {TooltipComponent} from '../tooltip/tooltip.component';

@Component({
  selector: 'app-scraper',
  standalone: true,
  imports: [
    MatIcon,
    LoadingComponent,
    TooltipComponent
  ],
  templateUrl: './scraper.component.html',
  styleUrl: './scraper.component.scss'
})
export class ScraperComponent {

}
