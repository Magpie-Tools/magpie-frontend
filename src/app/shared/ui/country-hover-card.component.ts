import {DOCUMENT} from '@angular/common';
import {CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition, Overlay} from '@angular/cdk/overlay';
import {ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, signal, viewChild} from '@angular/core';
import {buildCountryMapPreview, COUNTRY_PREVIEW_HEIGHT, COUNTRY_PREVIEW_WIDTH} from '../country-map-preview';
import {resolveWorldCountry} from '../world-map';
import {constrainMapView, MAP_MAX_ZOOM, mapPanKeyStep, mapWheelZoomFactor, mapZoomKeyFactor, svgMapPoint, zoomMapView} from '../map-navigation';

let nextCountryMapId = 0;

@Component({
  selector: 'app-country-hover-card',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {'(document:keydown.escape)': 'dismissMap($event)'},
  template: `
    @if (selectedCountry()) {
      <button #trigger type="button" class="country-trigger" cdkOverlayOrigin #origin="cdkOverlayOrigin"
        aria-haspopup="dialog" [attr.aria-expanded]="isOpen()" [attr.aria-controls]="isOpen() ? mapId : null"
        (mouseenter)="setPresence('triggerHover', true)" (mouseleave)="setPresence('triggerHover', false)"
        (focus)="setPresence('triggerFocus', true)" (blur)="setPresence('triggerFocus', false)"
        (click)="openMap()" (keydown)="onTriggerKeyDown($event)">
        <span>{{ country() || 'Unknown' }}</span>
        <i class="icon icon-globe" aria-hidden="true"></i>
      </button>
      <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="isOpen()"
        [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayPush]="true"
        [cdkConnectedOverlayFlexibleDimensions]="false" [cdkConnectedOverlayViewportMargin]="16"
        [cdkConnectedOverlayDisableClose]="true" [cdkConnectedOverlayScrollStrategy]="scrollStrategy"
        (overlayOutsideClick)="dismissOutside($event)">
        <div #mapCard class="country-hover-card" role="dialog" aria-modal="false" [id]="mapId"
          [attr.aria-labelledby]="mapId + '-title'"
          (mouseenter)="setPresence('cardHover', true)" (mouseleave)="setPresence('cardHover', false)"
          (focusin)="setPresence('cardFocus', true)" (focusout)="onCardFocusOut($event)">
          <header class="country-hover-card__heading">
            <i class="icon icon-globe" aria-hidden="true"></i>
            <strong [id]="mapId + '-title'">{{ country() }}</strong>
            <div class="country-hover-card__controls" role="group" aria-label="Map controls">
              <button type="button" class="country-hover-card__control country-hover-card__zoom"
                aria-label="Zoom out" title="Zoom out" [disabled]="!canZoomOut()" (click)="zoomBy(1 / 1.25)">
                <span aria-hidden="true">−</span>
              </button>
              <button type="button" class="country-hover-card__control country-hover-card__zoom"
                aria-label="Zoom in" title="Zoom in" [disabled]="!canZoomIn()" (click)="zoomBy(1.25)">
                <span aria-hidden="true">+</span>
              </button>
              <button type="button" class="country-hover-card__control country-hover-card__recenter"
                [disabled]="!hasChangedView()" (click)="recenter()">Recenter</button>
            </div>
          </header>
          @if (preview(); as map) {
            <svg class="country-hover-card__map" viewBox="0 0 360 220" role="img" tabindex="0"
              [class.country-hover-card__map--dragging]="isDragging()"
              [attr.aria-label]="'World map with ' + country() + ' marked. Drag or use arrow keys to move. Scroll or use plus and minus to zoom; Home recenters.'"
              (pointerdown)="startPan($event)" (pointermove)="movePan($event)" (pointerup)="endPan($event)"
              (pointercancel)="endPan($event)" (lostpointercapture)="endPan($event)" (keydown)="onMapKeyDown($event)"
              (wheel)="onMapWheel($event)">
              <g class="country-hover-card__pan" [attr.transform]="panTransform()">
                @for (offset of map.wrapOffsets; track offset) {
                  <g [attr.transform]="'translate(' + offset + ',0)'">
                    <g class="country-hover-card__countries">
                      @for (region of map.countries; track region.name) {
                        <path [attr.d]="region.path" />
                      }
                    </g>
                    <path class="country-hover-card__borders" [attr.d]="map.bordersPath" />
                    <path class="country-hover-card__selected" [attr.d]="map.selectedPath" />
                    <path class="country-hover-card__selected-border" [attr.d]="map.selectedBorderPath" />
                    <g class="country-hover-card__marker"
                      [attr.transform]="'translate(' + map.marker[0] + ',' + map.marker[1] + ') scale(' + 1 / zoom() + ')'">
                      <circle class="country-hover-card__marker-ring" r="9" />
                      <circle r="3.5" />
                    </g>
                  </g>
                }
              </g>
            </svg>
          }
        </div>
      </ng-template>
    } @else {
      <span>{{ country() || 'Unknown' }}</span>
    }
  `,
  styleUrl: './country-hover-card.component.scss',
})
export class CountryHoverCardComponent {
  readonly country = input<string | null | undefined>();
  readonly mapId = `country-map-${nextCountryMapId++}`;
  readonly selectedCountry = computed(() => resolveWorldCountry(this.country(), true));
  readonly isOpen = signal(false);
  readonly isDragging = signal(false);
  readonly zoom = signal(1);
  private readonly pan = signal<[number, number]>([0, 0]);
  readonly panTransform = computed(() => `translate(${this.pan()[0]},${this.pan()[1]}) scale(${this.zoom()})`);
  readonly hasChangedView = computed(() => this.zoom() !== 1 || this.pan().some(value => value !== 0));
  // The map is calculated only when the hover card first renders its content.
  readonly preview = computed(() => {
    const country = this.selectedCountry();
    return country ? buildCountryMapPreview(country) : null;
  });
  private readonly minZoom = computed(() => Math.min(1, COUNTRY_PREVIEW_WIDTH / (this.preview()?.worldWidth ?? COUNTRY_PREVIEW_WIDTH)));
  private readonly maxZoom = MAP_MAX_ZOOM;
  readonly canZoomOut = computed(() => this.zoom() > this.minZoom() + 1e-6);
  readonly canZoomIn = computed(() => this.zoom() < this.maxZoom - 1e-6);
  readonly positions: ConnectedPosition[] = [
    {originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8},
    {originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8},
  ];
  readonly scrollStrategy = inject(Overlay).scrollStrategies.reposition();
  private readonly document = inject(DOCUMENT);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly mapCard = viewChild<ElementRef<HTMLElement>>('mapCard');
  private readonly presence = {triggerHover: false, triggerFocus: false, cardHover: false, cardFocus: false};
  private hoverTimer?: ReturnType<typeof setTimeout>;
  private dismissed = false;
  private drag?: {pointerId: number; svg: SVGSVGElement; start: DOMPoint; pan: [number, number]};

  constructor() {
    effect(onCleanup => {
      this.country();
      onCleanup(() => this.closeMap());
    });
  }

  setPresence(area: keyof typeof this.presence, present: boolean): void {
    this.presence[area] = present;
    if (present && (area === 'triggerHover' || area === 'triggerFocus')) this.dismissed = false;
    this.updateVisibility();
  }

  onCardFocusOut(event: FocusEvent): void {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
      this.setPresence('cardFocus', false);
    }
  }

  onTriggerKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || event.shiftKey || !this.isOpen()) return;
    const map = this.mapCard()?.nativeElement.querySelector<SVGSVGElement>('svg');
    if (map) {
      event.preventDefault();
      map.focus({preventScroll: true});
    }
  }

  openMap(): void {
    clearTimeout(this.hoverTimer);
    this.dismissed = false;
    this.isOpen.set(true);
  }

  dismissOutside(event: MouseEvent): void {
    if (!this.trigger()?.nativeElement.contains(event.target as Node | null)) this.dismissMap(event);
  }

  dismissMap(event: Event): void {
    if (!this.isOpen()) return;
    if (event.type === 'keydown') {
      event.stopPropagation();
      if (this.mapCard()?.nativeElement.contains(this.document.activeElement)) {
        this.trigger()?.nativeElement.focus({preventScroll: true});
      }
    }
    this.dismissed = true;
    this.closeMap();
  }

  startPan(event: PointerEvent): void {
    if (this.drag || event.button !== 0 || !event.isPrimary) return;
    const svg = event.currentTarget as SVGSVGElement;
    event.preventDefault();
    svg.focus({preventScroll: true});
    this.drag = {pointerId: event.pointerId, svg, start: svgMapPoint(svg, event), pan: this.pan()};
    svg.setPointerCapture(event.pointerId);
    this.isDragging.set(true);
    this.updateVisibility();
  }

  movePan(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const point = svgMapPoint(this.drag.svg, event);
    this.setPan(this.drag.pan[0] + point.x - this.drag.start.x, this.drag.pan[1] + point.y - this.drag.start.y);
  }

  endPan(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    if (event.type === 'pointerup') this.movePan(event);
    this.stopDrag();
    this.updateVisibility();
  }

  onMapKeyDown(event: KeyboardEvent): void {
    const step = mapPanKeyStep(event.key);
    const factor = mapZoomKeyFactor(event);
    if (event.key === 'Home') {
      event.preventDefault();
      this.recenter();
    } else if (factor !== undefined) {
      event.preventDefault();
      this.zoomBy(factor);
    } else if (step) {
      event.preventDefault();
      const [x, y] = step;
      this.setPan(this.pan()[0] + x, this.pan()[1] + y);
    }
  }

  onMapWheel(event: WheelEvent): void {
    if (!event.deltaY) return;
    event.preventDefault();
    event.stopPropagation();
    const point = svgMapPoint(event.currentTarget as SVGSVGElement, event);
    this.zoomBy(mapWheelZoomFactor(event, COUNTRY_PREVIEW_HEIGHT), [point.x, point.y]);
  }

  zoomBy(factor: number, anchor?: [number, number]): void {
    if (!this.preview()) return;
    const view = {zoom: this.zoom(), pan: this.pan()};
    const next = zoomMapView(view, factor, anchor ?? [COUNTRY_PREVIEW_WIDTH / 2, COUNTRY_PREVIEW_HEIGHT / 2], this.minZoom());
    if (next === view) return;
    this.stopDrag();
    this.zoom.set(next.zoom);
    this.setPan(...next.pan);
    if (!anchor) this.mapCard()?.nativeElement.querySelector<SVGSVGElement>('svg')?.focus({preventScroll: true});
    this.updateVisibility();
  }

  recenter(): void {
    this.stopDrag();
    this.zoom.set(1);
    this.pan.set([0, 0]);
    this.mapCard()?.nativeElement.querySelector<SVGSVGElement>('svg')?.focus({preventScroll: true});
  }

  private setPan(x: number, y: number): void {
    const map = this.preview();
    if (!map) return;
    this.pan.set(constrainMapView({zoom: this.zoom(), pan: [x, y]}, {
      width: COUNTRY_PREVIEW_WIDTH, height: COUNTRY_PREVIEW_HEIGHT, worldWidth: map.worldWidth,
      worldTop: -map.panBounds.maxY, worldBottom: COUNTRY_PREVIEW_HEIGHT - map.panBounds.minY,
    }).pan);
  }

  private stopDrag(): void {
    const drag = this.drag;
    this.drag = undefined;
    this.isDragging.set(false);
    if (drag?.svg.hasPointerCapture(drag.pointerId)) drag.svg.releasePointerCapture(drag.pointerId);
  }

  private updateVisibility(): void {
    clearTimeout(this.hoverTimer);
    if (this.dismissed) return;
    if (this.isDragging() || Object.values(this.presence).some(Boolean)) {
      if (!this.isOpen()) this.hoverTimer = setTimeout(() => this.isOpen.set(true), 150);
    } else if (this.isOpen()) {
      this.hoverTimer = setTimeout(() => this.closeMap(), 200);
    }
  }

  private closeMap(): void {
    clearTimeout(this.hoverTimer);
    this.stopDrag();
    this.isOpen.set(false);
    this.presence.cardHover = false;
    this.presence.cardFocus = false;
    this.zoom.set(1);
    this.pan.set([0, 0]);
  }
}
