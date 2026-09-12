import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectComponent } from './select.component';

@Component({
  imports: [SelectComponent, ReactiveFormsModule],
  template: `
    <label for="test-select">Transport</label>
    <app-select
      inputId="test-select"
      [formControl]="control"
      [options]="options"
      optionLabel="label"
      optionValue="value"
      [multiple]="multiple"
      [filter]="multiple"
      [showClear]="multiple"
    />
  `,
})
class SelectHost {
  control = new FormControl<any>(0);
  multiple = false;
  options = [
    { label: 'Any', value: null },
    { label: 'Zero', value: 0 },
    { label: 'TCP', value: 'tcp' },
    { label: 'UDP', value: 'udp' },
  ];
}

describe('Spartan select form integration', () => {
  async function setup(multiple = false) {
    const fixture = TestBed.createComponent(SelectHost);
    fixture.componentInstance.multiple = multiple;
    if (multiple) fixture.componentInstance.control.setValue(['tcp']);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }
  function option(label: string): HTMLElement {
    const result = [
      ...document.querySelectorAll<HTMLElement>('hlm-select-item'),
    ].find((el) => el.textContent?.trim() === label);
    expect(result).withContext(`Rendered option ${label}`).toBeDefined();
    return result!;
  }
  it('opens options and preserves numeric zero, null and string form values', async () => {
    const fixture = await setup();
    const trigger = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    expect(trigger.textContent).toContain('Zero');
    trigger.click();
    await fixture.whenStable();
    option('TCP').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.control.value).toBe('tcp');
    expect(fixture.componentInstance.control.dirty).toBeTrue();
    trigger.click();
    await fixture.whenStable();
    option('Any').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.control.value).toBeNull();
    expect(trigger.textContent).toContain('Any');
  });
  it('filters and changes multiple values without replacing values with labels', async () => {
    const fixture = await setup(true);
    (
      fixture.nativeElement.querySelector('button') as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    const search = document.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )!;
    expect(search).toBeTruthy();
    search.value = 'udp';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(option('TCP').hidden).toBeTrue();
    option('UDP').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.control.value).toEqual(['tcp', 'udp']);
    const clear = [
      ...document.querySelectorAll<HTMLButtonElement>('button'),
    ].find((el) => el.textContent?.trim() === 'Clear selection')!;
    clear.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.control.value).toEqual([]);
  });
  it('reflects disabled state from the parent form', async () => {
    const fixture = await setup();
    fixture.componentInstance.control.disable();
    await fixture.whenStable();
    expect(
      (fixture.nativeElement.querySelector('button') as HTMLButtonElement)
        .disabled,
    ).toBeTrue();
  });
});
