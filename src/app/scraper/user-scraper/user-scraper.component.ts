import {Component} from '@angular/core';
import {ReactiveFormsModule} from "@angular/forms";
import {AddScrapeSourceComponent} from './add-scrape-source/add-scrape-source.component';
import {ScrapeSourceListComponent} from './scrape-source-list/scrape-source-list.component';
import {Button} from 'primeng/button';

@Component({
    selector: 'app-user-scraper',
  imports: [
    ReactiveFormsModule,
    AddScrapeSourceComponent,
    ScrapeSourceListComponent,
    Button
  ],
    templateUrl: './user-scraper.component.html',
    styleUrl: './user-scraper.component.scss'
})
export class UserScraperComponent{
  showSourceList: boolean = true;
  showNoSourceMessage: boolean = false;
}
