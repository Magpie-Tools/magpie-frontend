import {Component, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ProxyTag} from '../../models/ProxyTag';
import {ProxyTagSelectorComponent} from './proxy-tag-selector.component';

const tags: ProxyTag[] = [
  {id: 1, name: 'Datacenter', color: '#64748b'},
  {id: 2, name: 'Fast routes', color: '#22c55e'},
  {id: 3, name: 'Imported', color: '#06b6d4'},
  {id: 4, name: 'Needs review', color: '#ef4444'},
];

@Component({
  imports: [ProxyTagSelectorComponent],
  template: `
    <div class="tag-field" [style.width.px]="width()" [style.transform]="'scale(' + scale() + ')'">
      <app-proxy-tag-selector
        [availableTags]="selectedTags()"
        [selectedTags]="selectedTags()"
        [compact]="false"
        [maxVisibleTags]="maxVisibleTags()"
        [fitToWidth]="fitToWidth()"
        (selectionChange)="onSelection($event)"
      />
    </div>
  `,
})
class TagSelectorHost {
  readonly width = signal(300);
  readonly scale = signal(1);
  readonly selectedTags = signal(tags);
  readonly maxVisibleTags = signal(5);
  readonly fitToWidth = signal(true);
  readonly onSelection = jasmine.createSpy('selectionChange');
}

describe('ProxyTagSelectorComponent width fitting', () => {
  let fixture: ComponentFixture<TagSelectorHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [TagSelectorHost]}).compileComponents();
    fixture = TestBed.createComponent(TagSelectorHost);
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    for (let frame = 0; frame < 4; frame++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    await fixture.whenStable();
  }

  function visibleChips(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.proxy-tag-selector__chips > .proxy-tag-chip'));
  }

  function expectContainedTags(): void {
    const field = fixture.nativeElement.querySelector('.tag-field') as HTMLElement;
    const trigger = field.querySelector('.proxy-tag-selector') as HTMLButtonElement;
    const chips = trigger.querySelector('.proxy-tag-selector__chips') as HTMLElement;
    expect(trigger.getBoundingClientRect().right).toBeLessThanOrEqual(field.getBoundingClientRect().right + 0.5);
    for (const child of Array.from(chips.children)) {
      expect(child.getBoundingClientRect().left).toBeGreaterThanOrEqual(chips.getBoundingClientRect().left - 0.5);
      expect(child.getBoundingClientRect().right).toBeLessThanOrEqual(chips.getBoundingClientRect().right + 0.5);
    }
    const hiddenCount = fixture.componentInstance.selectedTags().length - visibleChips().length;
    const summary = chips.querySelector('.proxy-tag-selector__more');
    expect(summary?.textContent.trim() ?? '').toBe(hiddenCount > 0 ? `+${hiddenCount}` : '');
    const edit = trigger.querySelector('.proxy-tag-selector__edit') as HTMLElement;
    expect(edit.getBoundingClientRect().right).toBeLessThanOrEqual(trigger.getBoundingClientRect().right);
  }

  it('fits whole chips, reserves the overflow count, and restores tags when the field grows', async () => {
    await render();
    const narrowCount = visibleChips().length;
    expect(narrowCount).toBeGreaterThan(0);
    expect(narrowCount).toBeLessThan(tags.length);
    expectContainedTags();

    fixture.componentInstance.scale.set(0.8);
    await render();
    expect(visibleChips().length).toBe(narrowCount);
    expectContainedTags();

    fixture.componentInstance.width.set(700);
    await render();
    expect(visibleChips().length).toBe(tags.length);
    expectContainedTags();

    fixture.componentInstance.width.set(100);
    await render();
    expect(visibleChips().length).toBe(0);
    expectContainedTags();
  });

  it('refits when tag names and the selection change without a field resize', async () => {
    await render();
    const initialCount = visibleChips().length;
    fixture.componentInstance.selectedTags.set(tags.map(tag => ({...tag, name: tag.name.repeat(8)})));
    await render();
    expect(visibleChips().length).toBeLessThan(initialCount);
    expectContainedTags();

    fixture.componentInstance.selectedTags.set([tags[0]]);
    await render();
    expect(visibleChips().length).toBe(1);
    expectContainedTags();

    fixture.componentInstance.selectedTags.set([]);
    await render();
    expect(fixture.nativeElement.querySelector('.proxy-tag-selector').textContent).toContain('Add tags');

    fixture.componentInstance.selectedTags.set(tags);
    await render();
    expectContainedTags();
  });

  it('keeps hidden tags selected and available in the edit menu', async () => {
    fixture.componentInstance.width.set(100);
    await render();
    expect(visibleChips().length).toBe(0);
    fixture.nativeElement.querySelector('.proxy-tag-selector').click();
    await render();

    const menu = document.querySelector('.proxy-tag-menu') as HTMLElement;
    const inputs = Array.from(menu.querySelectorAll<HTMLInputElement>('input'));
    expect(inputs.length).toBe(tags.length);
    expect(inputs.every(input => input.checked)).toBeTrue();
    inputs[3].click();
    menu.querySelector<HTMLButtonElement>('.proxy-tag-menu__apply')!.click();
    await render();
    expect(fixture.componentInstance.onSelection).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('preserves the configured tag limit when width fitting is disabled', async () => {
    fixture.componentInstance.fitToWidth.set(false);
    fixture.componentInstance.maxVisibleTags.set(2);
    await render();
    expect(visibleChips().length).toBe(2);
    expect(fixture.nativeElement.querySelector('.proxy-tag-selector__more').textContent).toBe('+2');
  });
});
