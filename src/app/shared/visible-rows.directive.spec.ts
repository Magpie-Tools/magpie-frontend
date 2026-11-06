import {Component, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {VisibleRowsDirective} from './visible-rows.directive';

@Component({
  imports: [VisibleRowsDirective],
  template: `
    <section [hidden]="hidden()">
      <div class="row-list" [appVisibleRows]="visibleRows()"
        [style.transform]="'scale(' + scale() + ')'"
        style="display: grid; gap: 8px; width: 320px">
        @for (row of rows(); track row.id) {
          <div class="row" [style.height.px]="row.height">
            <input [attr.aria-label]="'Row ' + row.id" />
          </div>
        }
      </div>
    </section>
  `,
})
class VisibleRowsHost {
  readonly visibleRows = signal(3.5);
  readonly scale = signal(1);
  readonly hidden = signal(false);
  readonly rows = signal([60, 80, 100, 120, 140, 160].map((height, id) => ({id, height})));
}

describe('VisibleRowsDirective', () => {
  let fixture: ComponentFixture<VisibleRowsHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [VisibleRowsHost]}).compileComponents();
    fixture = TestBed.createComponent(VisibleRowsHost);
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    // Let mutations and browser resize observations reach the rendered list.
    for (let frame = 0; frame < 3; frame++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    await fixture.whenStable();
  }

  function list(): HTMLElement {
    return fixture.nativeElement.querySelector('.row-list');
  }

  function expectVisibleRows(count: number): void {
    const bounds = list().getBoundingClientRect();
    const rows = Array.from(list().children, row => row.getBoundingClientRect());
    const fullRows = Math.floor(count);
    for (let index = 0; index < fullRows; index++) {
      expect(rows[index].top).toBeGreaterThanOrEqual(bounds.top - 1);
      expect(rows[index].bottom).toBeLessThanOrEqual(bounds.bottom + 1);
    }
    if (count % 1) {
      const nextRow = rows[fullRows];
      expect((bounds.bottom - nextRow.top) / nextRow.height).toBeCloseTo(count % 1, 2);
    } else {
      expect(rows[fullRows - 1].bottom).toBeCloseTo(bounds.bottom, 0);
    }
    expect(rows[Math.ceil(count)].top).toBeGreaterThanOrEqual(bounds.bottom);
    expect(list().scrollHeight).toBeGreaterThan(list().clientHeight);
  }

  it('clips halfway through the next row despite unequal row heights and gaps', async () => {
    await render();
    expectVisibleRows(3.5);
    expect(getComputedStyle(list()).overflowY).toBe('auto');

    list().scrollTop = list().scrollHeight;
    const lastRow = list().lastElementChild!.getBoundingClientRect();
    expect(lastRow.bottom).toBeLessThanOrEqual(list().getBoundingClientRect().bottom + 1);
  });

  it('supports a different fractional limit and an integer limit', async () => {
    fixture.componentInstance.visibleRows.set(4.5);
    await render();
    expectVisibleRows(4.5);

    fixture.componentInstance.visibleRows.set(2);
    await render();
    expectVisibleRows(2);
  });

  it('recalculates when rows resize while their container is scaled', async () => {
    fixture.componentInstance.scale.set(0.8);
    await render();
    expectVisibleRows(3.5);

    fixture.componentInstance.rows.update(rows => rows.map(row => ({...row, height: row.height * 2})));
    await render();
    expectVisibleRows(3.5);
  });

  it('releases the height limit for short lists and restores it as items arrive', async () => {
    const rows = fixture.componentInstance.rows();
    fixture.componentInstance.rows.set([]);
    await render();
    expect(list().style.maxHeight).toBe('');

    fixture.componentInstance.rows.set(rows.slice(0, 3));
    await render();
    expect(list().style.maxHeight).toBe('');
    expect(list().scrollHeight).toBe(list().clientHeight);

    fixture.componentInstance.rows.set(rows);
    await render();
    expectVisibleRows(3.5);

    fixture.componentInstance.rows.set(rows.slice(0, 2));
    await render();
    expect(list().style.maxHeight).toBe('');
    expect(list().scrollHeight).toBe(list().clientHeight);
  });

  it('measures rows when a previously hidden section becomes visible', async () => {
    fixture.componentInstance.hidden.set(true);
    await render();
    expect(list().style.maxHeight).toBe('');

    fixture.componentInstance.hidden.set(false);
    await render();
    expectVisibleRows(3.5);
  });
});
