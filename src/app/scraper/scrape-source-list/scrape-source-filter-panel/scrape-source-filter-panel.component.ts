import {HlmButton} from '@spartan-ng/helm/button';
import {HlmInput} from '@spartan-ng/helm/input';
import {HlmCheckbox} from '@spartan-ng/helm/checkbox';
import {SelectComponent} from '../../../shared/ui/select.component';
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormGroup, ReactiveFormsModule} from '@angular/forms';
import {NgClass} from '@angular/common';

@Component({
  selector: 'app-scrape-source-filter-panel',
  standalone: true,
  imports: [HlmButton, HlmInput, HlmCheckbox, SelectComponent,
    ReactiveFormsModule,
    NgClass,

  ],
  templateUrl: './scrape-source-filter-panel.component.html',
  styleUrl: './scrape-source-filter-panel.component.scss',
})
export class ScrapeSourceFilterPanelComponent {
  @Input({required: true}) form!: FormGroup;
  @Input() floating = true;
  @Input() showHeader = true;

  @Output() apply = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();

  readonly countOperatorOptions = [
    {label: '>', value: '>'},
    {label: '<', value: '<'},
  ];
}
