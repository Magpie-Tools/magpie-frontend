import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
@Component({
  selector: 'app-password',
  imports: [HlmInput, HlmButton],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PasswordComponent),
      multi: true,
    },
  ],
  host: { class: 'relative block' },
  template: `
    <input
      hlmInput
      class="w-full pr-12"
      [type]="revealed() ? 'text' : 'password'"
      [id]="inputId()"
      [value]="value()"
      [autocomplete]="autocomplete()"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      (input)="update($any($event.target).value)"
      (blur)="onTouched()"
    />
    <button
      hlmBtn
      variant="ghost"
      size="icon-sm"
      type="button"
      class="absolute right-1 top-0.5"
      [attr.aria-label]="revealed() ? 'Hide password' : 'Show password'"
      [attr.aria-pressed]="revealed()"
      [disabled]="disabled()"
      (click)="revealed.set(!revealed())"
    >
      <i
        [class]="revealed() ? 'icon icon-eye-off' : 'icon icon-eye'"
        aria-hidden="true"
      ></i>
    </button>
  `,
})
export class PasswordComponent implements ControlValueAccessor {
  readonly inputId = input('password');
  readonly autocomplete = input('current-password');
  readonly placeholder = input('');
  readonly revealed = signal(false);
  readonly disabled = signal(false);
  readonly value = signal('');
  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};
  update(value: string): void {
    this.value.set(value);
    this.onChange(value);
  }
  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
