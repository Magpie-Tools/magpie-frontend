import {ComponentFixture, TestBed} from '@angular/core/testing';
import {InventoryPageShellComponent} from './inventory-page-shell.component';

describe('InventoryPageShellComponent entrance', () => {
  let fixture: ComponentFixture<InventoryPageShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [InventoryPageShellComponent]}).compileComponents();
    fixture = TestBed.createComponent(InventoryPageShellComponent);
    fixture.componentRef.setInput('loading', true);
    fixture.componentRef.setInput('loadingLabel', 'Loading routes');
    fixture.componentRef.setInput('pageTitle', 'Managed proxies');
    fixture.componentRef.setInput('searchAriaLabel', 'Search proxies');
  });

  async function renderShell(combinedCard = true): Promise<void> {
    fixture.componentRef.setInput('combinedCard', combinedCard);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function card(): HTMLElement {
    return fixture.nativeElement.querySelector('.inventory-card');
  }

  function entranceTarget(): HTMLElement {
    return fixture.componentInstance.combinedCard
      ? fixture.nativeElement.querySelector('.inventory-grid')
      : card();
  }

  async function settleLoad(totalItems = 12): Promise<void> {
    fixture.componentRef.setInput('totalItems', totalItems);
    fixture.componentRef.setInput('hasLoaded', true);
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  for (const combinedCard of [true, false]) {
    it(`reveals the heading and controls during the first request with combinedCard=${combinedCard}`, async () => {
      await renderShell(combinedCard);
      const element = fixture.nativeElement as HTMLElement;
      const heading = element.querySelector<HTMLElement>('.inventory-context')!;
      const toolbar = element.querySelector<HTMLElement>('.inventory-toolbar')!;
      const grid = element.querySelector<HTMLElement>('.inventory-grid')!;
      const search = element.querySelector<HTMLInputElement>('input[type="search"]')!;
      const entrance = entranceTarget().getAnimations()[0];
      const headingEntrance = heading.getAnimations()[0];

      expect(getComputedStyle(heading).visibility).toBe('visible');
      expect(getComputedStyle(toolbar).visibility).toBe('visible');
      expect(getComputedStyle(heading).opacity).toBe('1');
      expect(getComputedStyle(toolbar).opacity).toBe('1');
      expect(getComputedStyle(grid).opacity).toBe('1');
      expect(headingEntrance).toBeInstanceOf(CSSAnimation);
      expect(entrance).toBeInstanceOf(CSSAnimation);
      expect(entrance.effect!.getTiming().duration).toBe(650);
      expect(entrance.effect!.getTiming().delay).toBe(combinedCard ? 55 : 110);
      expect(getComputedStyle(heading).transform).not.toBe('none');
      expect(getComputedStyle(card()).visibility).toBe('visible');
      expect(search.disabled).toBeFalse();
      expect(element.querySelector('.inventory-initial-loading')).toBeNull();
      expect(element.querySelector('.empty-inventory')).toBeNull();
      expect(element.querySelector('.inventory-page')!.hasAttribute('aria-busy')).toBeFalse();
      expect(card().getAttribute('aria-busy')).toBe('true');
      expect(entrance).toBeDefined();

      // The whole entrance finishes while the table request is still pending.
      headingEntrance.finish();
      entrance.finish();
      expect(getComputedStyle(heading).opacity).toBe('1');
      expect(getComputedStyle(entranceTarget()).opacity).toBe('1');
      expect(heading.style.transform).toBe('');
      expect(entranceTarget().style.transform).toBe('');
      expect(fixture.componentInstance.loading).toBeTrue();
    });
  }

  it('keeps the same entrance when data arrives and during later refreshes', async () => {
    await renderShell();
    const entrance = entranceTarget().getAnimations()[0];
    entrance.pause();
    entrance.currentTime = 350;

    // Receiving data can precede the request finalizer that clears loading.
    fixture.componentRef.setInput('hasLoaded', true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(entranceTarget().getAnimations()).toEqual([entrance]);
    expect(getComputedStyle(card()).visibility).toBe('visible');

    await settleLoad();
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getComputedStyle(card()).visibility).toBe('visible');
    expect(fixture.nativeElement.querySelector('.inventory-initial-loading')).toBeNull();

    await settleLoad();
    expect(entranceTarget().getAnimations()).toEqual([entrance]);
    expect(entrance.currentTime).toBe(350);
  });

  it('shows the empty state only after the first request settles', async () => {
    await renderShell();
    expect(fixture.nativeElement.querySelector('.empty-inventory')).toBeNull();
    await settleLoad(0);
    expect(fixture.nativeElement.querySelector('.empty-inventory')).not.toBeNull();
    expect(getComputedStyle(card()).visibility).toBe('visible');
    expect(card().getAttribute('aria-busy')).toBe('false');
  });

  it('does not replay a completed entrance when data arrives or refreshes', async () => {
    await renderShell();
    entranceTarget().getAnimations()[0].finish();
    expect(getComputedStyle(entranceTarget()).transform).toBe('none');

    await settleLoad();
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(entranceTarget().getAnimations()).toEqual([]);
    expect(getComputedStyle(entranceTarget()).transform).toBe('none');
  });
});
