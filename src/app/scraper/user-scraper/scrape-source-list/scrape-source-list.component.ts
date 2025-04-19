import {Component, EventEmitter, Output} from '@angular/core';

@Component({
  selector: 'app-scrape-source-list',
  standalone: true,
  imports: [],
  templateUrl: './scrape-source-list.component.html',
  styleUrl: './scrape-source-list.component.scss'
})
export class ScrapeSourceListComponent {
  @Output() showAddProxiesMessage = new EventEmitter<boolean>();

}
