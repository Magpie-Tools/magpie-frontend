import {HlmSwitch} from '@spartan-ng/helm/switch';
import {afterNextRender, Component, effect, inject, Injector, input, output, viewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TooltipComponent} from '../../tooltip/tooltip.component';

@Component({
  selector: 'app-source-fetch-mode',
  imports: [HlmSwitch, FormsModule, TooltipComponent],
  template: `
    <div class="fetch-mode" [class.fetch-mode--compact]="compact()" [attr.aria-busy]="saving()">
      <div class="fetch-mode__copy">
        <span class="fetch-mode__icon"><i class="icon icon-code" aria-hidden="true"></i></span>
        <div class="fetch-mode__heading">
          <label [for]="inputId()">Requires JavaScript</label>
          <app-tooltip [text]="(enabled()
            ? 'Browser rendering for pages that load proxies with JavaScript.'
            : 'HTTP fetching for static pages and raw proxy lists. Uses fewer resources.')
            + (hint() ? ' ' + hint() : '')" />
        </div>
      </div>
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
  readonly compact = input(false);
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
