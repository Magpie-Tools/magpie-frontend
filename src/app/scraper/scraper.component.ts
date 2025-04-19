import {ReactiveFormsModule} from '@angular/forms';
import {Component} from '@angular/core';

@Component({
  selector: 'app-scraper',
  standalone: true,
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './scraper.component.html',
  styleUrl: './scraper.component.scss'
})
export class ScraperComponent {

}
