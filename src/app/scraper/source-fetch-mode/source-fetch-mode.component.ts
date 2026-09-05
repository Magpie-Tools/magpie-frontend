import {afterNextRender, Component, effect, inject, Injector, input, output, viewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ToggleSwitch, ToggleSwitchModule} from 'primeng/toggleswitch';

@Component({
  selector: 'app-source-fetch-mode',
  imports: [FormsModule, ToggleSwitchModule],
  template: `
    <div class="fetch-mode" [attr.aria-busy]="saving()">
      <label class="fetch-mode__copy" [for]="inputId()">
        <span class="fetch-mode__icon"><i class="pi pi-code" aria-hidden="true"></i></span>
        <span>
          <strong>Requires JavaScript</strong>
          <small>{{ enabled() ? 'Browser rendering for pages that load proxies with JavaScript.' : 'HTTP fetching for static pages and raw proxy lists. Uses fewer resources.' }}</small>
          @if (hint()) { <small class="fetch-mode__hint">{{ hint() }}</small> }
        </span>
      </label>
      <div class="fetch-mode__control">
        <span class="fetch-mode__state" aria-live="polite">{{ saving() ? 'Saving…' : enabled() ? 'On' : 'Off' }}</span>
        <p-toggleswitch #toggle [inputId]="inputId()" [ngModel]="enabled()"
          [disabled]="disabled() || saving()" ariaLabel="Requires JavaScript"
          (ngModelChange)="changeMode($event, toggle)" />
      </div>
    </div>
  `,
  styleUrl: './source-fetch-mode.component.scss',
})
export class SourceFetchModeComponent {
  readonly inputId = input.required<string>();
  readonly enabled = input(false);
  readonly disabled = input(false);
  readonly saving = input(false);
  readonly hint = input('');
  readonly enabledChange = output<boolean>();

  private readonly toggle = viewChild(ToggleSwitch);
  private readonly injector = inject(Injector);

  constructor() {
    effect(() => this.toggle()?.writeValue(this.enabled()));
  }

  changeMode(enabled: boolean, toggle: ToggleSwitch): void {
    this.enabledChange.emit(enabled);
    // Keep the switch on the persisted value while a settings request is pending.
    afterNextRender(() => toggle.writeValue(this.enabled()), {injector: this.injector});
  }
}
