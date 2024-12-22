import { Component } from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {LoadingComponent} from '../loading/loading.component';
import {TooltipComponent} from '../tooltip/tooltip.component';
import {MatTab, MatTabGroup} from '@angular/material/tabs';
import {NgForOf} from '@angular/common';
import {FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule} from '@angular/forms';

@Component({
  selector: 'app-scraper',
  standalone: true,
  imports: [
    MatIcon,
    LoadingComponent,
    TooltipComponent,
    MatTab,
    NgForOf,
    MatTabGroup,
    ReactiveFormsModule
  ],
  templateUrl: './scraper.component.html',
  styleUrl: './scraper.component.scss'
})
export class ScraperComponent {
  scraperForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.scraperForm = this.fb.group({
      sources: this.fb.array([]),
      scrapeInterval: new FormControl(10),
      maxProxies: new FormControl(100),
      scrapeThreads: new FormControl(5),
      log: new FormControl('')
    });
  }

  get sources(): FormArray {
    return this.scraperForm.get('sources') as FormArray;
  }

  addSource() {
    this.sources.push(this.fb.group({
      url: [''],
      delimiter: ['']
    }));
  }

  onSubmit() {
    console.log(this.scraperForm.value);
    // Save settings or trigger scraper logic here
  }
}
