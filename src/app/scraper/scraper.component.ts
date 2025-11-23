import {ReactiveFormsModule} from '@angular/forms';
import {Component} from '@angular/core';
import {ScrapeSourceListComponent} from './scrape-source-list/scrape-source-list.component';

@Component({
    selector: 'app-scraper',
  imports: [
    ReactiveFormsModule,
    ScrapeSourceListComponent,
  ],
    templateUrl: './scraper.component.html',
    styleUrl: './scraper.component.scss',
  standalone: true
})
export class ScraperComponent {
  showNoSourceMessage: boolean = false;

}
