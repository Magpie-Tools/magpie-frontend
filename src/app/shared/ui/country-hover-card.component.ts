import {ChangeDetectionStrategy, Component, computed, effect, input, viewChild} from '@angular/core';
import {BrnHoverCard, BrnHoverCardContentService, BrnHoverCardImports} from '@spartan-ng/brain/hover-card';
import {buildCountryMapPreview} from '../country-map-preview';
import {resolveWorldCountry} from '../world-map';

let nextCountryMapId = 0;

@Component({
  selector: 'app-country-hover-card',
  imports: [BrnHoverCardImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {'(document:keydown.escape)': 'dismissMap($event)'},
  template: `
    @if (selectedCountry(); as selected) {
      <brn-hover-card>
        <button type="button" class="country-trigger" brnHoverCardTrigger
          align="bottom" [sideOffset]="8" [showDelay]="150" [hideDelay]="200" [animationDelay]="0"
          [attr.aria-describedby]="mapId">
          <span>{{ country() || 'Unknown' }}</span>
          <i class="icon icon-globe" aria-hidden="true"></i>
        </button>
        <div *brnHoverCardContent class="country-hover-card" role="tooltip" [id]="mapId">
          <header class="country-hover-card__heading">
            <i class="icon icon-globe" aria-hidden="true"></i>
            <strong>{{ country() }}</strong>
          </header>
          @if (preview(); as map) {
            <svg class="country-hover-card__map" viewBox="0 0 360 220" role="img"
              [attr.aria-label]="'World map centered on ' + country()">
              <g class="country-hover-card__countries">
                @for (region of map.countries; track region.name) {
                  <path [attr.d]="region.path" />
                }
              </g>
              <path class="country-hover-card__selected" [attr.d]="map.selectedPath" />
              <g class="country-hover-card__marker" [attr.transform]="'translate(' + map.marker[0] + ',' + map.marker[1] + ')'">
                <circle class="country-hover-card__marker-ring" r="9" />
                <circle r="3.5" />
              </g>
            </svg>
          }
        </div>
      </brn-hover-card>
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
  // The map is calculated only when the hover card first renders its content.
  readonly preview = computed(() => {
    const country = this.selectedCountry();
    return country ? buildCountryMapPreview(country) : null;
  });
  private readonly hoverCard = viewChild(BrnHoverCard, {read: BrnHoverCardContentService});

  constructor() {
    effect(onCleanup => {
      const hoverCard = this.hoverCard();
      onCleanup(() => hoverCard?.hide());
    });
  }

  dismissMap(event: Event): void {
    const hoverCard = this.hoverCard();
    if (hoverCard?.state() !== 'open') return;
    event.stopPropagation();
    hoverCard.setState('closed');
    hoverCard.hide();
  }
}
