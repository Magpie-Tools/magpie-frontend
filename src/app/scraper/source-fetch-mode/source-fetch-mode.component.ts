import {HlmSwitch} from '@spartan-ng/helm/switch';
import {afterNextRender, Component, effect, inject, Injector, input, output, viewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-source-fetch-mode',
  imports: [HlmSwitch, FormsModule],
  template: `
    <div class="fetch-mode" [attr.aria-busy]="saving()">
      <label class="fetch-mode__copy" [for]="inputId()">
        <span class="fetch-mode__icon"><i class="icon icon-code" aria-hidden="true"></i></span>
        <span>
          <strong>Requires JavaScript</strong>
          <small>{{ enabled() ? 'Browser rendering for pages that load proxies with JavaScript.' : 'HTTP fetching for static pages and raw proxy lists. Uses fewer resources.' }}</small>
          @if (hint()) { <small class="fetch-mode__hint">{{ hint() }}</small> }
        </span>
      </label>
      <div class="fetch-mode__control">
        <span class="fetch-mode__state" aria-live="polite">{{ saving() ? 'Saving…' : enabled() ? 'On' : 'Off' }}</span>
        <hlm-switch #toggle class="cursor-pointer" [inputId]="inputId()" [ngModel]="enabled()" [disabled]="disabled() || saving()" (ngModelChange)="changeMode($event, toggle)" aria-label="Requires JavaScript" />
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

  private readonly toggle = viewChild(HlmSwitch);
  private readonly injector = inject(Injector);

  constructor() {
    effect(() => this.toggle()?.writeValue(this.enabled()));
  }

  changeMode(enabled: boolean, toggle: HlmSwitch): void {
    this.enabledChange.emit(enabled);
    // Keep the switch on the persisted value while a settings request is pending.
    afterNextRender(() => toggle.writeValue(this.enabled()), {injector: this.injector});
  }
}
