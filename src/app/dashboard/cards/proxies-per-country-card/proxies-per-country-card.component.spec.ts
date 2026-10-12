import { ComponentFixture, TestBed } from '@angular/core/testing';
import {createChartScene} from '@tanstack/charts';
import {buildCountryMapProjection} from './country-map-chart';

import { ProxiesPerCountryCardComponent } from './proxies-per-country-card.component';

describe('ProxiesPerCountryCardComponent', () => {
  let component: ProxiesPerCountryCardComponent;
  let fixture: ComponentFixture<ProxiesPerCountryCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProxiesPerCountryCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProxiesPerCountryCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  async function render() {
    fixture.detectChanges();
    for (let frame = 0; frame < 4; frame++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    await fixture.whenStable();
  }

  async function openMap() {
    fixture.nativeElement.style.width = '600px';
    fixture.componentRef.setInput('countries', [
      {name: 'USA', percentage: 80, value: 1200},
      {name: 'Germany', percentage: 20, value: 300},
    ]);
    await render();
    const host = fixture.nativeElement.querySelector('.map-frame') as HTMLElement;
    const svg = host.querySelector('svg') as SVGSVGElement;
    const chart = component.mapChart;
    if (!('marks' in chart)) throw new Error('Expected country map chart');
    const bounds = createChartScene(chart, {
      width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height,
    }).chart;
    return {host, svg, bounds};
  }

  function mockPointerCapture(host: HTMLElement, svg: SVGSVGElement) {
    let captured = false;
    const capture = spyOn(host, 'setPointerCapture').and.callFake(() => { captured = true; });
    const release = spyOn(host, 'releasePointerCapture').and.callFake(() => { captured = false; });
    spyOn(host, 'hasPointerCapture').and.callFake(() => captured);
    spyOn(svg, 'getScreenCTM').and.returnValue(new DOMMatrix([0.5, 0, 0, 0.5, 10, 20]));
    return {capture, release};
  }

  function pointer(target: Element, type: string, options: PointerEventInit = {}) {
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 7, isPrimary: true, button: 0,
      clientX: 100, clientY: 80, ...options,
    }));
    fixture.detectChanges();
  }

  function press(target: Element, key: string) {
    const event = new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true});
    target.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should resolve the Saint Lucia flag from common labels', () => {
    expect(component.countryFlag({name: 'Saint Lucia', percentage: 10})).toBe('🇱🇨');
    expect(component.countryFlag({name: 'St. Lucia', percentage: 10})).toBe('🇱🇨');
  });

  it('should resolve the DRC flag from the parenthesized Congo label', () => {
    expect(component.countryFlag({name: 'Congo (DRC)', percentage: 10})).toBe('🇨🇩');
  });

  it('joins aliases to the same map feature and retains unknown countries in the list', () => {
    fixture.componentRef.setInput('countries', [
      {name: 'USA', percentage: 25, value: 10},
      {name: 'United States', percentage: 50, value: 20},
      {name: 'Unknown', percentage: 25, value: 10},
    ]);
    fixture.detectChanges();
    expect(component.mapFeatures.find(feature => feature.properties.name === 'United States of America')?.properties.value).toBe(30);
    expect(component.maxCountryValue).toBe(30);
    expect(component.totalValue).toBe(40);
    expect(component.mapFeatures.some(feature => feature.properties.name === 'Antarctica')).toBeFalse();
    fixture.nativeElement.querySelector('.country-tabs button:nth-child(2)').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.country-list').textContent).toContain('Unknown');
    fixture.nativeElement.querySelector('.country-tabs button:nth-child(1)').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('tanstack-chart')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('canvas')).toBeNull();
  });

  it('zooms with the controls and resets the view while retaining country counts', async () => {
    const {host, svg} = await openMap();
    const zoomIn = host.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!;
    const zoomOut = host.querySelector<HTMLButtonElement>('[aria-label="Zoom out"]')!;
    const reset = host.querySelector<HTMLButtonElement>('.map-controls button:last-child')!;
    const initialPaths = [...svg.querySelectorAll('path')].map(path => path.getAttribute('d')).join();
    const features = component.mapFeatures;
    expect(zoomOut.disabled).toBeTrue();
    expect(reset.disabled).toBeTrue();
    zoomIn.click();
    await render();
    expect(component.mapView().zoom).toBe(1.25);
    expect(zoomOut.disabled).toBeFalse();
    expect(reset.disabled).toBeFalse();
    expect([...host.querySelectorAll('svg path')].map(path => path.getAttribute('d')).join()).not.toBe(initialPaths);
    expect(component.mapFeatures).toBe(features);
    expect(component.totalValue).toBe(1500);
    expect(document.activeElement).toBe(host);
    reset.click();
    await render();
    expect(component.mapView()).toEqual({zoom: 1, pan: [0, 0]});
    expect(zoomOut.disabled).toBeTrue();
    expect(reset.disabled).toBeTrue();
  });

  for (const pointerType of ['mouse', 'touch']) {
    it(`pans with a ${pointerType} drag at the rendered SVG scale and restores hover afterward`, async () => {
      const {host, svg, bounds} = await openMap();
      const {capture, release} = mockPointerCapture(host, svg);
      pointer(svg, 'pointerdown', {pointerType});
      expect(capture).toHaveBeenCalledWith(7);
      expect(host.classList.contains('map-frame--dragging')).toBeTrue();
      expect(component.mapChart.pointer).toBeFalse();
      pointer(host, 'pointermove', {clientX: 120, pointerType});
      await render();
      expect(component.mapView().pan[0]).toBeCloseTo(40 / bounds.width, 5);
      expect(host.querySelector('svg')).toBe(svg);
      pointer(host, 'pointerup', {clientX: 125, pointerType});
      expect(component.mapView().pan[0]).toBeCloseTo(50 / bounds.width, 5);
      expect(release).toHaveBeenCalledWith(7);
      expect(component.mapChart.pointer).toBeTrue();
      expect(component.isMapDragging()).toBeFalse();
    });
  }

  it('ignores map controls, secondary pointers, and unrelated moves during a drag', async () => {
    const {host, svg} = await openMap();
    const {capture, release} = mockPointerCapture(host, svg);
    pointer(host.querySelector('[aria-label="Zoom in"]')!, 'pointerdown');
    pointer(svg, 'pointerdown', {button: 2});
    pointer(svg, 'pointerdown', {isPrimary: false});
    expect(capture).not.toHaveBeenCalled();
    pointer(svg, 'pointerdown');
    pointer(host, 'pointermove', {pointerId: 8, clientX: 140});
    pointer(host, 'pointerup', {pointerId: 8});
    expect(component.mapView().pan).toEqual([0, 0]);
    expect(release).not.toHaveBeenCalled();
    pointer(host, 'pointercancel');
    expect(release).toHaveBeenCalledWith(7);
    expect(component.mapChart.pointer).toBeTrue();
  });

  it('zooms at the pointer location and clamps zoom to the whole world and close views', async () => {
    const {host, svg, bounds} = await openMap();
    mockPointerCapture(host, svg);
    const point: [number, number] = [220, 140];
    const before = buildCountryMapProjection(component.mapFeatures, bounds, component.mapView()).projection.invert!(point)!;
    const wheel = (deltaY: number) => {
      const event = new WheelEvent('wheel', {bubbles: true, cancelable: true, clientX: 120, clientY: 90, deltaY});
      host.dispatchEvent(event);
      fixture.detectChanges();
      return event;
    };
    expect(wheel(-100).defaultPrevented).toBeTrue();
    const after = buildCountryMapProjection(component.mapFeatures, bounds, component.mapView()).projection.invert!(point)!;
    expect(after[0]).toBeCloseTo(before[0], 5);
    expect(after[1]).toBeCloseTo(before[1], 5);
    for (let index = 0; index < 3; index++) wheel(-1000);
    expect(component.mapView().zoom).toBe(8);
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.disabled).toBeTrue();
    for (let index = 0; index < 3; index++) wheel(1000);
    expect(component.mapView().zoom).toBe(1);
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Zoom out"]')!.disabled).toBeTrue();
    expect(wheel(0).defaultPrevented).toBeFalse();
  });

  it('supports keyboard panning, zooming, and reset without intercepting control keystrokes', async () => {
    const {host, bounds} = await openMap();
    expect(press(host, '+').defaultPrevented).toBeTrue();
    expect(component.mapView().zoom).toBe(1.25);
    const pan = component.mapView().pan;
    expect(press(host, 'ArrowRight').defaultPrevented).toBeTrue();
    press(host, 'ArrowDown');
    expect(component.mapView().pan[0]).toBeCloseTo(pan[0] - 32 / bounds.width, 5);
    expect(component.mapView().pan[1]).toBeCloseTo(pan[1] - 32 / bounds.height, 5);
    expect(press(host.querySelector('[aria-label="Zoom in"]')!, 'ArrowRight').defaultPrevented).toBeFalse();
    expect(press(host, 'Enter').defaultPrevented).toBeFalse();
    expect(press(host, 'Home').defaultPrevented).toBeTrue();
    expect(component.mapView()).toEqual({zoom: 1, pan: [0, 0]});
  });

  it('preserves the view across refreshed counts and the list while releasing interrupted drags', async () => {
    const {host, svg} = await openMap();
    const {release} = mockPointerCapture(host, svg);
    component.zoomMapBy(2);
    fixture.componentRef.setInput('countries', [{name: 'Germany', percentage: 100, value: 500}]);
    await render();
    expect(component.mapView().zoom).toBe(2);
    expect(component.mapFeatures.find(feature => feature.properties.name === 'Germany')?.properties.value).toBe(500);
    pointer(host.querySelector('svg')!, 'pointerdown');
    await render();
    fixture.nativeElement.querySelector('.country-tabs button:nth-child(2)').click();
    await render();
    expect(release).toHaveBeenCalledWith(7);
    expect(component.isMapDragging()).toBeFalse();
    fixture.nativeElement.querySelector('.country-tabs button:nth-child(1)').click();
    await render();
    expect(component.mapView().zoom).toBe(2);
    expect(component.mapChart.pointer).toBeTrue();
    expect(fixture.nativeElement.querySelector('svg')).not.toBeNull();
  });

  it('releases pointer capture when the map disappears or the card is destroyed', async () => {
    const {host, svg} = await openMap();
    const {release} = mockPointerCapture(host, svg);
    pointer(svg, 'pointerdown');
    fixture.componentRef.setInput('countries', []);
    await render();
    expect(release).toHaveBeenCalledWith(7);
    expect(component.isMapDragging()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.map-frame')).toBeNull();
    const reopened = await openMap();
    const nextCapture = mockPointerCapture(reopened.host, reopened.svg);
    pointer(reopened.svg, 'pointerdown');
    fixture.destroy();
    expect(nextCapture.release).toHaveBeenCalledWith(7);
  });
});
