import { Component } from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {NgForOf} from '@angular/common';
import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';

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
export class ScraperComponent {
  scraperForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.scraperForm = this.fb.group({
      sources: this.fb.array([]),
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
