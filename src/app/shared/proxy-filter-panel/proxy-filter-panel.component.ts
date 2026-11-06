import {HlmButton} from '@spartan-ng/helm/button';
import {HlmInput} from '@spartan-ng/helm/input';
import {HlmCheckbox} from '@spartan-ng/helm/checkbox';
import {SelectComponent} from '../ui/select.component';
import {Component, EventEmitter, Input, Output, signal} from '@angular/core';
import {FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';

import {NgClass} from '@angular/common';
import {PROXY_STATE_OPTIONS, ProxyFilterOption} from '../proxy-filters';
import {ProxyTag} from '../../models/ProxyTag';

@Component({
  selector: 'app-proxy-filter-panel',
  standalone: true,
  imports: [HlmButton, HlmInput, HlmCheckbox, SelectComponent,
    ReactiveFormsModule,
    FormsModule,

    NgClass,
  ],
  templateUrl: './proxy-filter-panel.component.html',
  styleUrl: './proxy-filter-panel.component.scss',
})
export class ProxyFilterPanelComponent {
  readonly proxyStateOptions = PROXY_STATE_OPTIONS;
  @Input({required: true}) form!: FormGroup;
  @Input() countryOptions: ProxyFilterOption[] = [];
  @Input() typeOptions: ProxyFilterOption[] = [];
  @Input() anonymityOptions: ProxyFilterOption[] = [];
  @Input() proxyStatusOptions: ProxyFilterOption[] = [];
  @Input() proxyReputationOptions: ProxyFilterOption[] = [];
  @Input() tagOptions: ProxyTag[] = [];
  @Input() floating = true;
  @Input() showHeader = true;

  @Output() apply = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();

  protected readonly healthFiltersExpanded = signal(false);

  toggleHealthFilters(): void {
    this.healthFiltersExpanded.update(value => !value);
  }

  activeHealthFilterCount(): number {
    if (!this.form) {
      return 0;
    }

    const value = this.form.getRawValue() as Record<string, unknown>;
    const healthKeys = [
      'minHealthOverall',
      'minHealthHttp',
      'minHealthHttps',
      'minHealthSocks4',
      'minHealthSocks5',
    ];

    return healthKeys.reduce((count, key) => {
      const current = Number(value[key] ?? 0);
      return Number.isFinite(current) && current > 0 ? count + 1 : count;
    }, 0);
  }
}
