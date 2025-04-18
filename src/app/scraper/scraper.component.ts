import {
  FormArray,
  FormBuilder,
  FormGroup, ReactiveFormsModule,
} from '@angular/forms';
import {SettingsService} from '../services/settings.service';
import {Component, OnInit} from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {NgForOf} from '@angular/common';
import {SnackbarService} from '../services/snackbar.service';

@Component({
  selector: 'app-scraper',
  standalone: true,
  imports: [
    MatIcon,
    NgForOf,
    ReactiveFormsModule
  ],
  templateUrl: './scraper.component.html',
  styleUrl: './scraper.component.scss'
})
export class ScraperComponent implements OnInit {
  scraperForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private settings: SettingsService
  ) {
    this.scraperForm = this.fb.group({
      sources: this.buildSourcesArray(),   // empty array on first load
    });
  }

  ngOnInit(): void {
    const initialSites =
      this.settings.getUserSettings()?.scraping_sources ?? [];

    this.scraperForm.setControl(
      'sources',
      this.buildSourcesArray(initialSites)
    );
  }

  private buildSourcesArray(urls: string[] = []) {
    return this.fb.array(
      urls.map(u => this.fb.group({ url: [u] }))
    );
  }

  get sources(): FormArray {
    return this.scraperForm.get('sources') as FormArray;
  }

  addSource(): void {
    this.sources.push(
      this.fb.group({
        url: ['']
      })
    );
  }

  removeSource(index: number): void {
    if (index < 0 || index >= this.sources.length) {
      return;
    }

    this.sources.removeAt(index);
  }


  onSubmit(): void {
    // if (this.scraperForm.invalid) return;
    const urls = this.sources.controls.map(
      g => g.get('url')!.value as string
    );

    this.settings.saveUserScrapingSources(urls).subscribe(
      res => {
        SnackbarService.openSnackbar("Sites saved successfully", 3000)
      }
    );
  }
}
