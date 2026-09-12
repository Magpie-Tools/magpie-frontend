import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  forwardRef,
  input,
  signal,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';

/** Form adapter for the application's option objects. Values retain their original types. */
@Component({
  selector: 'app-select',
  imports: [HlmSelectImports, HlmInput, HlmButton, NgTemplateOutlet],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    @if (multiple()) {
      <hlm-select-multiple
        [value]="selectedKeys()"
        [disabled]="disabled()"
        (valueChange)="choose($event)"
        (closed)="onTouched()"
      >
        <hlm-select-trigger [buttonId]="inputId()" class="w-full">
          <span class="truncate">{{ selectedLabels() || placeholder() }}</span>
        </hlm-select-trigger>
        <hlm-select-content *hlmSelectPortal class="app-select-overlay"
          (click)="$event.stopPropagation()">
          @if (filter()) {
            <div class="sticky top-0 z-10 bg-popover p-2">
              <input
                hlmInput
                type="search"
                aria-label="Filter options"
                placeholder="Search options"
                [value]="query()"
                (input)="query.set($any($event.target).value)"
                (keydown)="$event.key !== 'Escape' && $event.stopPropagation()"
              />
            </div>
          }
          @if (showClear()) {
            <button
              hlmBtn
              variant="ghost"
              size="sm"
              type="button"
              (click)="clear()"
            >
              Clear selection
            </button>
          }
          <div hlmSelectGroup>
            @for (option of options(); track $index) {
              <hlm-select-item
                [value]="key($index)"
                [hidden]="!matches(option)"
                [disabled]="!matches(option)"
              >
                @if (optionTemplate) {
                  <ng-container
                    [ngTemplateOutlet]="optionTemplate"
                    [ngTemplateOutletContext]="{ $implicit: option }"
                  />
                } @else {
                  {{ label(option) }}
                }
              </hlm-select-item>
            }
            @if (!hasMatches()) {
              <p class="p-3 text-sm text-muted-foreground" role="status">
                No matching options.
              </p>
            }
          </div>
        </hlm-select-content>
      </hlm-select-multiple>
    } @else {
      <hlm-select
        [value]="selectedKey()"
        [disabled]="disabled()"
        (valueChange)="choose([$event])"
        (closed)="onTouched()"
      >
        <hlm-select-trigger [buttonId]="inputId()" class="w-full">
          @if (selectedKey() !== null) {
            @let option = selectedOption();
            @if (optionTemplate) {
              <ng-container
                [ngTemplateOutlet]="optionTemplate"
                [ngTemplateOutletContext]="{ $implicit: option }"
              />
            } @else {
              <span class="truncate">{{ label(option) }}</span>
            }
          } @else {
            <span class="truncate">{{ placeholder() }}</span>
          }
        </hlm-select-trigger>
        <hlm-select-content *hlmSelectPortal class="app-select-overlay"
          (click)="$event.stopPropagation()">
          @if (filter()) {
            <div class="sticky top-0 z-10 bg-popover p-2">
              <input
                hlmInput
                type="search"
                aria-label="Filter options"
                placeholder="Search options"
                [value]="query()"
                (input)="query.set($any($event.target).value)"
                (keydown)="$event.key !== 'Escape' && $event.stopPropagation()"
              />
            </div>
          }
          @if (showClear()) {
            <button
              hlmBtn
              variant="ghost"
              size="sm"
              type="button"
              (click)="clear()"
            >
              Clear selection
            </button>
          }
          <div hlmSelectGroup>
            @for (option of options(); track $index) {
              <hlm-select-item
                [value]="key($index)"
                [hidden]="!matches(option)"
                [disabled]="!matches(option)"
              >
                @if (optionTemplate) {
                  <ng-container
                    [ngTemplateOutlet]="optionTemplate"
                    [ngTemplateOutletContext]="{ $implicit: option }"
                  />
                } @else {
                  {{ label(option) }}
                }
              </hlm-select-item>
            }
            @if (!hasMatches()) {
              <p class="p-3 text-sm text-muted-foreground" role="status">
                No matching options.
              </p>
            }
          </div>
        </hlm-select-content>
      </hlm-select>
    }
  `,
})
export class SelectComponent implements ControlValueAccessor {
  private static nextId = 0;
  readonly options = input<readonly any[]>([]);
  readonly optionLabel = input('label');
  readonly optionValue = input<string>();
  readonly inputId = input(`app-select-${SelectComponent.nextId++}`);
  readonly placeholder = input('Select an option');
  readonly multiple = input(false);
  readonly filter = input(false);
  readonly showClear = input(false);
  @ContentChild('optionTemplate') optionTemplate?: TemplateRef<{
    $implicit: any;
  }>;
  readonly value = signal<any>(null);
  readonly disabled = signal(false);
  readonly query = signal('');
  onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};
  key(index: number): string {
    return String(index);
  }
  optionData(option: any): any {
    const field = this.optionValue();
    return field ? option?.[field] : option;
  }
  label(option: any): string {
    return String(option?.[this.optionLabel()] ?? option ?? '');
  }
  selectedKeys(): string[] {
    const values = this.multiple() ? (this.value() ?? []) : [this.value()];
    return this.options().flatMap((option, index) =>
      values.some((v: any) => Object.is(v, this.optionData(option)))
        ? [this.key(index)]
        : [],
    );
  }
  selectedKey(): string | null {
    return this.selectedKeys().at(0) ?? null;
  }
  selectedOption(): any {
    const index = this.selectedKeys()[0];
    return index === undefined ? undefined : this.options()[Number(index)];
  }
  selectedLabels(): string {
    return this.selectedKeys()
      .map((key) => this.label(this.options()[Number(key)]))
      .join(', ');
  }
  matches(option: any): boolean {
    return this.label(option)
      .toLocaleLowerCase()
      .includes(this.query().toLocaleLowerCase());
  }
  hasMatches(): boolean {
    return this.options().some((option) => this.matches(option));
  }
  choose(keys: unknown): void {
    if (this.disabled()) return;
    const selected = (Array.isArray(keys) ? keys : [])
      .filter((key) => key !== null && key !== undefined)
      .map((key) => this.optionData(this.options()[Number(key)]));
    const value = this.multiple() ? selected : (selected[0] ?? null);
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }
  clear(): void {
    this.choose([]);
  }
  writeValue(value: any): void {
    this.value.set(value);
  }
  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
