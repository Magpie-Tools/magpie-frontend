import {Component} from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {ReactiveFormsModule} from "@angular/forms";
import {AddProxiesComponent} from '../../proxies/add-proxies/add-proxies.component';
import {ProxyListComponent} from '../../proxies/proxy-list/proxy-list.component';
import {AddScrapeSourceComponent} from './add-scrape-source/add-scrape-source.component';
import {ScrapeSourceListComponent} from './scrape-source-list/scrape-source-list.component';

@Component({
  selector: 'app-user-scraper',
  standalone: true,
  imports: [
    MatIcon,
    ReactiveFormsModule,
    AddProxiesComponent,
    ProxyListComponent,
    AddScrapeSourceComponent,
    ScrapeSourceListComponent
  ],
  templateUrl: './user-scraper.component.html',
  styleUrl: './user-scraper.component.scss'
})
export class UserScraperComponent{
  showSourceList: boolean = true;
  showNoSourceMessage: boolean = false;
}
