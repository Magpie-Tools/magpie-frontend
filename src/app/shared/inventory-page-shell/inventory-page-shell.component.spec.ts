import {ComponentFixture, TestBed} from '@angular/core/testing';
import {gsap} from 'gsap';
import {InventoryPageShellComponent} from './inventory-page-shell.component';

describe('InventoryPageShellComponent entrance', () => {
  let fixture: ComponentFixture<InventoryPageShellComponent>;
  let reducedMotion: boolean;

  beforeEach(async () => {
    reducedMotion = false;
    spyOn(window, 'matchMedia').and.callFake(() => ({matches: reducedMotion}) as MediaQueryList);
    await TestBed.configureTestingModule({imports: [InventoryPageShellComponent]}).compileComponents();
    fixture = TestBed.createComponent(InventoryPageShellComponent);
    fixture.componentRef.setInput('loading', true);
    fixture.componentRef.setInput('loadingLabel', 'Loading routes');
    fixture.detectChanges();
  });

  function card(): HTMLElement {
    return fixture.nativeElement.querySelector('.inventory-card');
  }

  function settleLoad(totalItems = 12): void {
    fixture.componentRef.setInput('totalItems', totalItems);
    fixture.componentRef.setInput('hasLoaded', true);
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
  }

  it('waits for the first request to finish before animating the loaded layout', () => {
    expect(getComputedStyle(card()).visibility).toBe('hidden');
    expect(gsap.getTweensOf(card()).length).toBe(0);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Loading routes');

    // Receiving data can precede the request finalizer that clears loading.
    fixture.componentRef.setInput('hasLoaded', true);
    fixture.detectChanges();
    expect(gsap.getTweensOf(card()).length).toBe(0);
    expect(getComputedStyle(card()).visibility).toBe('hidden');

    settleLoad();
    expect(getComputedStyle(card()).visibility).toBe('visible');
    expect(gsap.getTweensOf(card()).length).toBe(1);
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });

  it('does not hide the page or restart an active entrance during a refresh', () => {
    settleLoad();
    const entrance = gsap.getTweensOf(card())[0];
    entrance.pause().progress(0.5);

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(getComputedStyle(card()).visibility).toBe('visible');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();

    settleLoad();
    expect(gsap.getTweensOf(card())).toEqual([entrance]);
    expect(entrance.progress()).toBe(0.5);
  });

  it('reveals an empty first result', () => {
    settleLoad(0);
    expect(fixture.nativeElement.querySelector('.empty-inventory')).not.toBeNull();
    expect(getComputedStyle(card()).visibility).toBe('visible');
    expect(gsap.getTweensOf(card()).length).toBe(1);
  });

  it('shows the settled content without animation for reduced motion', () => {
    reducedMotion = true;
    settleLoad();
    expect(getComputedStyle(card()).visibility).toBe('visible');
    expect(gsap.getTweensOf(card()).length).toBe(0);
    expect(card().style.opacity).toBe('');
  });

  it('removes the entrance tween when navigating away', () => {
    settleLoad();
    const target = card();
    fixture.destroy();
    expect(gsap.getTweensOf(target).length).toBe(0);
  });
});
