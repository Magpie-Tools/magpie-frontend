import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ScrapeSourceListComponent} from './scrape-source-list/scrape-source-list.component';

@Component({
    selector: 'app-user-scraper',
  imports: [
    CommonModule,
    ScrapeSourceListComponent,
  ],
    templateUrl: './user-scraper.component.html',
    styleUrl: './user-scraper.component.scss'
})
export class UserScraperComponent{
  showNoSourceMessage: boolean = false;
}
