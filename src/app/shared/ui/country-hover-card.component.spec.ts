import {ComponentFixture, TestBed} from '@angular/core/testing';
import {CountryHoverCardComponent} from './country-hover-card.component';
import {COUNTRY_PREVIEW_HEIGHT, COUNTRY_PREVIEW_WIDTH} from '../country-map-preview';

describe('CountryHoverCardComponent', () => {
  let fixture: ComponentFixture<CountryHoverCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [CountryHoverCardComponent]}).compileComponents();
    fixture = TestBed.createComponent(CountryHoverCardComponent);
    fixture.componentRef.setInput('country', 'Germany');
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  const settleHover = async () => {
    await new Promise(resolve => setTimeout(resolve, 250));
    fixture.detectChanges();
  };

  const openMap = () => {
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    return document.querySelector('.country-hover-card__map') as SVGSVGElement;
  };

  const mockPointerCapture = (svg: SVGSVGElement) => {
    let captured = false;
    const capture = spyOn(svg, 'setPointerCapture').and.callFake(() => { captured = true; });
    const release = spyOn(svg, 'releasePointerCapture').and.callFake(() => { captured = false; });
    spyOn(svg, 'hasPointerCapture').and.callFake(() => captured);
    spyOn(svg, 'getScreenCTM').and.returnValue(new DOMMatrix([0.5, 0, 0, 0.5, 10, 20]));
    return {capture, release};
  };

  const pointer = (svg: SVGSVGElement, type: string, options: PointerEventInit = {}) => {
    svg.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 7, isPrimary: true, button: 0,
      clientX: 100, clientY: 80, ...options,
    }));
    fixture.detectChanges();
  };

  const pan = () => fixture.componentInstance.panTransform().match(/translate\(([^,]+),([^\)]+)\)/)!.slice(1).map(Number);

  const press = (svg: SVGSVGElement, key: string) => {
    const event = new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true});
    svg.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };

  const wheel = (svg: SVGSVGElement, options: WheelEventInit = {}) => {
    const event = new WheelEvent('wheel', {
      bubbles: true, cancelable: true, clientX: 120, clientY: 90, deltaY: -100, ...options,
    });
    svg.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };

  it('opens the marked map on hover and keeps it open while the pointer enters the card', async () => {
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(document.querySelector('.country-hover-card')).toBeNull();
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await settleHover();
    const card = document.querySelector('.country-hover-card') as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.id).toBe(trigger.getAttribute('aria-controls')!);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.querySelector('svg')?.getAttribute('aria-label')).toContain('Germany marked');
    expect(card.querySelector('.country-hover-card__selected')?.getAttribute('d')).toBeTruthy();
    expect(card.querySelector('.country-hover-card__marker')).not.toBeNull();
    trigger.dispatchEvent(new MouseEvent('mouseleave'));
    card.dispatchEvent(new MouseEvent('mouseenter'));
    await settleHover();
    expect(document.querySelector('.country-hover-card')).toBe(card);
    card.dispatchEvent(new MouseEvent('mouseleave'));
    await settleHover();
    expect(document.querySelector('.country-hover-card')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('lets keyboard users enter the map and retains it while focus moves between its controls', async () => {
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    await settleHover();
    trigger.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', bubbles: true, cancelable: true}));
    fixture.detectChanges();
    const svg = document.querySelector('.country-hover-card__map') as SVGSVGElement;
    expect(document.activeElement).toBe(svg);
    press(svg, 'ArrowRight');
    const recenter = document.querySelector('.country-hover-card__recenter') as HTMLButtonElement;
    recenter.focus();
    await settleHover();
    expect(document.querySelector('.country-hover-card__map')).toBe(svg);
    expect(document.activeElement).toBe(recenter);
    recenter.blur();
    await settleHover();
    expect(document.querySelector('.country-hover-card')).toBeNull();
  });

  for (const pointerType of ['mouse', 'touch']) {
    it(`pans with a ${pointerType} drag at the displayed SVG scale without rebuilding country paths`, () => {
      const svg = openMap();
      const {capture, release} = mockPointerCapture(svg);
      const preview = fixture.componentInstance.preview();
      const countryPath = svg.querySelector('.country-hover-card__selected')!;
      const originalPath = countryPath.getAttribute('d');
      pointer(svg, 'pointerdown', {pointerType});
      expect(capture).toHaveBeenCalledWith(7);
      expect(svg.classList.contains('country-hover-card__map--dragging')).toBeTrue();
      pointer(svg, 'pointermove', {clientX: 120, clientY: 95, pointerType});
      expect(pan()[0]).toBeCloseTo(40, 5);
      expect(pan()[1]).toBeCloseTo(30, 5);
      pointer(svg, 'pointerup', {clientX: 125, clientY: 100, pointerType});
      expect(pan()[0]).toBeCloseTo(50, 5);
      expect(pan()[1]).toBeCloseTo(40, 5);
      expect(release).toHaveBeenCalledWith(7);
      expect(svg.classList.contains('country-hover-card__map--dragging')).toBeFalse();
      expect(fixture.componentInstance.preview()).toBe(preview);
      expect(svg.querySelector('.country-hover-card__selected')).toBe(countryPath);
      expect(countryPath.getAttribute('d')).toBe(originalPath);
    });
  }

  it('ignores secondary pointers and unrelated moves during a drag', () => {
    const svg = openMap();
    const {capture, release} = mockPointerCapture(svg);
    pointer(svg, 'pointerdown', {button: 2});
    pointer(svg, 'pointerdown', {isPrimary: false});
    expect(capture).not.toHaveBeenCalled();
    pointer(svg, 'pointerdown');
    pointer(svg, 'pointermove', {pointerId: 8, clientX: 130});
    pointer(svg, 'pointerup', {pointerId: 8});
    expect(pan()).toEqual([0, 0]);
    expect(release).not.toHaveBeenCalled();
    pointer(svg, 'pointermove', {clientX: 120});
    pointer(svg, 'pointercancel');
    expect(pan()[0]).toBeCloseTo(40, 5);
    expect(release).toHaveBeenCalledWith(7);
    expect(fixture.componentInstance.isDragging()).toBeFalse();
  });

  it('keeps the card open when a captured drag leaves its edges, then closes after the interaction ends', async () => {
    const svg = openMap();
    mockPointerCapture(svg);
    pointer(svg, 'pointerdown');
    svg.blur();
    document.querySelector('.country-hover-card')!.dispatchEvent(new MouseEvent('mouseleave'));
    await settleHover();
    expect(document.querySelector('.country-hover-card__map')).toBe(svg);
    pointer(svg, 'pointerup');
    await settleHover();
    expect(document.querySelector('.country-hover-card')).toBeNull();
  });

  it('wraps longitude and clamps vertical panning to the projected world', () => {
    const svg = openMap();
    mockPointerCapture(svg);
    const map = fixture.componentInstance.preview()!;
    pointer(svg, 'pointerdown');
    pointer(svg, 'pointermove', {clientX: 100 + (map.worldWidth + 40) / 2, clientY: 10000});
    expect(pan()[0]).toBeCloseTo(40, 5);
    expect(pan()[1]).toBeCloseTo(map.panBounds.maxY, 5);
    pointer(svg, 'pointermove', {clientX: 100 - (map.worldWidth + 40) / 2, clientY: -10000});
    expect(pan()[0]).toBeCloseTo(-40, 5);
    expect(pan()[1]).toBeCloseTo(map.panBounds.minY, 5);
    expect(svg.querySelectorAll('.country-hover-card__countries').length).toBe(3);
  });

  it('supports arrow keys and restores the country view with Home or Recenter', () => {
    const svg = openMap();
    const recenter = document.querySelector('.country-hover-card__recenter') as HTMLButtonElement;
    expect(recenter.disabled).toBeTrue();
    expect(press(svg, 'ArrowRight').defaultPrevented).toBeTrue();
    press(svg, 'ArrowDown');
    expect(pan()[0]).toBeCloseTo(-32, 5);
    expect(pan()[1]).toBeCloseTo(-32, 5);
    expect(recenter.disabled).toBeFalse();
    press(svg, 'ArrowLeft');
    press(svg, 'ArrowUp');
    expect(pan()).toEqual([0, 0]);
    expect(press(svg, 'Enter').defaultPrevented).toBeFalse();
    press(svg, 'ArrowLeft');
    expect(press(svg, 'Home').defaultPrevented).toBeTrue();
    expect(pan()).toEqual([0, 0]);
    press(svg, 'ArrowUp');
    recenter.click();
    fixture.detectChanges();
    expect(pan()).toEqual([0, 0]);
    expect(recenter.disabled).toBeTrue();
    expect(document.activeElement).toBe(svg);
  });

  it('zooms around the viewport center with the buttons and keeps country paths and marker size intact', () => {
    const svg = openMap();
    const preview = fixture.componentInstance.preview();
    const path = svg.querySelector('.country-hover-card__selected')!;
    const originalPath = path.getAttribute('d');
    const zoomIn = document.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!;
    const zoomOut = document.querySelector<HTMLButtonElement>('button[aria-label="Zoom out"]')!;
    zoomIn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.zoom()).toBeCloseTo(1.25, 5);
    expect(pan()[0]).toBeCloseTo(-COUNTRY_PREVIEW_WIDTH / 2 * 0.25, 5);
    expect(pan()[1]).toBeCloseTo(-COUNTRY_PREVIEW_HEIGHT / 2 * 0.25, 5);
    expect(document.activeElement).toBe(svg);
    expect(svg.querySelector('.country-hover-card__marker')!.getAttribute('transform')).toContain('scale(0.8)');
    expect(fixture.componentInstance.preview()).toBe(preview);
    expect(svg.querySelector('.country-hover-card__selected')).toBe(path);
    expect(path.getAttribute('d')).toBe(originalPath);
    zoomOut.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.zoom()).toBeCloseTo(1, 5);
    expect(pan()[0]).toBeCloseTo(0, 5);
    expect(pan()[1]).toBeCloseTo(0, 5);
  });

  it('anchors wheel zoom under the pointer at the displayed SVG scale, including after panning', () => {
    const svg = openMap();
    mockPointerCapture(svg);
    press(svg, 'ArrowRight');
    press(svg, 'ArrowDown');
    // The mocked screen matrix maps client (120,90) to SVG (220,140).
    const anchor = [220, 140];
    const previousPan = pan();
    const countryPoint = anchor.map((coordinate, index) => coordinate - previousPan[index]);
    expect(wheel(svg).defaultPrevented).toBeTrue();
    const zoom = fixture.componentInstance.zoom();
    expect(zoom).toBeGreaterThan(1);
    for (let index = 0; index < 2; index++) {
      expect(pan()[index] + countryPoint[index] * zoom).toBeCloseTo(anchor[index], 5);
    }
    wheel(svg, {deltaY: 100});
    expect(fixture.componentInstance.zoom()).toBeCloseTo(1, 5);
    expect(pan()[0]).toBeCloseTo(previousPan[0], 5);
    expect(pan()[1]).toBeCloseTo(previousPan[1], 5);
  });

  it('handles wheel pixel, line, and page units consistently without consuming horizontal scrolling', () => {
    const svg = openMap();
    mockPointerCapture(svg);
    wheel(svg, {deltaY: -16, deltaMode: WheelEvent.DOM_DELTA_PIXEL});
    const pixelZoom = fixture.componentInstance.zoom();
    press(svg, 'Home');
    wheel(svg, {deltaY: -1, deltaMode: WheelEvent.DOM_DELTA_LINE});
    expect(fixture.componentInstance.zoom()).toBeCloseTo(pixelZoom, 5);
    press(svg, 'Home');
    wheel(svg, {deltaY: -COUNTRY_PREVIEW_HEIGHT, deltaMode: WheelEvent.DOM_DELTA_PIXEL});
    const pageZoom = fixture.componentInstance.zoom();
    press(svg, 'Home');
    wheel(svg, {deltaY: -1, deltaMode: WheelEvent.DOM_DELTA_PAGE});
    expect(fixture.componentInstance.zoom()).toBeCloseTo(pageZoom, 5);
    const horizontal = wheel(svg, {deltaY: 0, deltaX: 100});
    expect(horizontal.defaultPrevented).toBeFalse();
    expect(fixture.componentInstance.zoom()).toBeCloseTo(pageZoom, 5);
  });

  it('limits zoom to the whole-world view and a close view, disabling controls at each limit', () => {
    const svg = openMap();
    mockPointerCapture(svg);
    const zoomOut = document.querySelector<HTMLButtonElement>('button[aria-label="Zoom out"]')!;
    const zoomIn = document.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!;
    for (let index = 0; index < 5; index++) wheel(svg, {deltaY: -1000});
    const maxZoom = fixture.componentInstance.zoom();
    expect(zoomIn.disabled).toBeTrue();
    expect(zoomOut.disabled).toBeFalse();
    expect(maxZoom).toBeGreaterThan(1);
    press(svg, '+');
    expect(fixture.componentInstance.zoom()).toBe(maxZoom);
    for (let index = 0; index < 5; index++) wheel(svg, {deltaY: 1000});
    const minZoom = fixture.componentInstance.zoom();
    expect(fixture.componentInstance.preview()!.worldWidth * minZoom).toBeCloseTo(COUNTRY_PREVIEW_WIDTH, 5);
    expect(zoomOut.disabled).toBeTrue();
    expect(zoomIn.disabled).toBeFalse();
    press(svg, '-');
    expect(fixture.componentInstance.zoom()).toBe(minZoom);
  });

  it('uses the zoomed world dimensions when wrapping and clamping a drag', () => {
    const svg = openMap();
    mockPointerCapture(svg);
    press(svg, '+');
    const zoom = fixture.componentInstance.zoom();
    const map = fixture.componentInstance.preview()!;
    const originalPan = pan();
    pointer(svg, 'pointerdown');
    pointer(svg, 'pointermove', {clientX: 100 + (map.worldWidth * zoom + 40) / 2, clientY: 10000});
    expect(pan()[0]).toBeCloseTo(originalPan[0] + 40, 5);
    expect(pan()[1]).toBeCloseTo(map.panBounds.maxY * zoom, 5);
    pointer(svg, 'pointermove', {clientX: 100 - (map.worldWidth * zoom + 40) / 2, clientY: -10000});
    expect(pan()[0]).toBeCloseTo(originalPan[0] - 40, 5);
    expect(pan()[1]).toBeCloseTo(COUNTRY_PREVIEW_HEIGHT - (COUNTRY_PREVIEW_HEIGHT - map.panBounds.minY) * zoom, 5);
  });

  it('restores both zoom and position with Home, Recenter, or a new country', () => {
    const svg = openMap();
    const recenter = document.querySelector('.country-hover-card__recenter') as HTMLButtonElement;
    expect(press(svg, '+').defaultPrevented).toBeTrue();
    press(svg, 'ArrowRight');
    expect(recenter.disabled).toBeFalse();
    press(svg, 'Home');
    expect(fixture.componentInstance.zoom()).toBe(1);
    expect(pan()).toEqual([0, 0]);
    expect(recenter.disabled).toBeTrue();
    press(svg, '=');
    expect(fixture.componentInstance.zoom()).toBeGreaterThan(1);
    press(svg, '-');
    expect(fixture.componentInstance.zoom()).toBeCloseTo(1, 5);
    press(svg, '_');
    expect(fixture.componentInstance.zoom()).toBeLessThan(1);
    recenter.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.zoom()).toBe(1);
    expect(pan()).toEqual([0, 0]);
    expect(document.activeElement).toBe(svg);
    press(svg, '+');
    fixture.componentRef.setInput('country', 'Fiji');
    fixture.detectChanges();
    expect(document.querySelector('.country-hover-card')).toBeNull();
    expect(fixture.componentInstance.zoom()).toBe(1);
    expect(pan()).toEqual([0, 0]);
    const reopened = openMap();
    expect(reopened.getAttribute('aria-label')).toContain('Fiji marked');
  });

  it('returns focus to the country on Escape and does not reopen while the pointer remains on the card', async () => {
    const svg = openMap();
    svg.focus();
    press(svg, 'ArrowRight');
    press(svg, 'Escape');
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector('.country-hover-card')).toBeNull();
    await settleHover();
    expect(document.querySelector('.country-hover-card')).toBeNull();
    trigger.click();
    fixture.detectChanges();
    expect(document.querySelector('.country-hover-card')).not.toBeNull();
    expect(pan()).toEqual([0, 0]);
  });

  it('dismisses on an outside click while allowing clicks on the country trigger', () => {
    openMap();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(document.querySelector('.country-hover-card')).not.toBeNull();
    document.body.click();
    fixture.detectChanges();
    expect(document.querySelector('.country-hover-card')).toBeNull();
  });

  it('releases an active drag and resets the view when the country changes', () => {
    const svg = openMap();
    const {release} = mockPointerCapture(svg);
    pointer(svg, 'pointerdown');
    pointer(svg, 'pointermove', {clientX: 130});
    fixture.componentRef.setInput('country', 'Fiji');
    fixture.detectChanges();
    expect(document.querySelector('.country-hover-card')).toBeNull();
    expect(release).toHaveBeenCalledWith(7);
    expect(pan()).toEqual([0, 0]);
    const reopened = openMap();
    expect(reopened.getAttribute('aria-label')).toContain('Fiji marked');
  });

  it('opens on keyboard focus and dismisses with Escape without moving focus', async () => {
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    await settleHover();
    expect(document.querySelector('.country-hover-card')).not.toBeNull();
    trigger.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    fixture.detectChanges();
    expect(document.querySelector('.country-hover-card')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    trigger.blur();
  });

  it('dismisses a map opened by hovering when Escape is pressed elsewhere', async () => {
    fixture.nativeElement.querySelector('button').dispatchEvent(new MouseEvent('mouseenter'));
    await settleHover();
    expect(document.querySelector('.country-hover-card')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    fixture.detectChanges();
    expect(document.querySelector('.country-hover-card')).toBeNull();
  });

  it('removes an open overlay when leaving the proxy details', async () => {
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    await settleHover();
    expect(document.querySelector('.country-hover-card')).not.toBeNull();
    fixture.destroy();
    expect(document.querySelector('.country-hover-card')).toBeNull();
  });

  it('removes an open map if the next proxy has no known country', async () => {
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    await settleHover();
    expect(document.querySelector('.country-hover-card')).not.toBeNull();
    fixture.componentRef.setInput('country', 'Unknown');
    fixture.detectChanges();
    expect(document.querySelector('.country-hover-card')).toBeNull();
  });

  it('shows unknown or unsupported countries as plain text', () => {
    for (const country of ['Unknown', 'N/A', 'Atlantis', '']) {
      fixture.componentRef.setInput('country', country);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent.trim()).toBe(country || 'Unknown');
      expect(fixture.nativeElement.querySelector('button')).toBeNull();
    }
  });
});
