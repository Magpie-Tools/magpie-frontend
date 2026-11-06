import {Directive, ElementRef, forwardRef, inject} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';

/**
 * Number inputs where 0 means "no limit" or "any": the field shows empty (so its placeholder
 * explains the default) instead of a 0 that looks like an active filter, and an emptied field
 * writes 0 back to the form.
 */
@Directive({
  selector: 'input[type=number][appZeroAsEmpty]',
  standalone: true,
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ZeroAsEmptyDirective), multi: true}],
  host: {
    '(input)': 'handleInput($any($event.target).value)',
    '(blur)': 'onTouched()',
  },
})
export class ZeroAsEmptyDirective implements ControlValueAccessor {
  private readonly input = inject(ElementRef<HTMLInputElement>).nativeElement as HTMLInputElement;
  private onChange: (value: number) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: unknown): void {
    const number = Number(value);
    this.input.value = value === null || value === undefined || value === '' || number === 0 ? '' : String(value);
  }

  handleInput(raw: string): void {
    const number = Number(raw);
    this.onChange(raw === '' || !Number.isFinite(number) ? 0 : number);
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.input.disabled = disabled;
  }
}
