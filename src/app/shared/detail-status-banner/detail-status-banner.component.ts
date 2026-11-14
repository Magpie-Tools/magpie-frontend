import {DatePipe} from '@angular/common';
import {Component, computed, DestroyRef, inject, input, signal} from '@angular/core';
import {formatTimeAgo} from '../time-ago';

export type DetailStatusTone = 'good' | 'warn' | 'bad' | 'neutral';

const TONE_ICONS: Record<DetailStatusTone, string> = {
  good: 'icon-circle-check',
  warn: 'icon-circle-alert',
  bad: 'icon-circle-x',
  neutral: 'icon-circle-minus',
};

/**
 * Tinted header band for a detail overview panel: the latest result, how long ago it happened, and
 * its exact time. Projected content (e.g. a range switch) sits at the trailing end. The host bleeds
 * to the panel edges when the panel sets --status-banner-inset-block / --status-banner-inset-inline
 * to its own padding.
 */
@Component({
  selector: 'app-detail-status-banner',
  imports: [DatePipe],
  host: {
    'class': 'status-banner',
    '[attr.data-tone]': 'tone()',
  },
  template: `
    <i class="icon status-banner__icon" [class]="iconName()" aria-hidden="true"></i>
    <div class="status-banner__text" role="status">
      <strong class="status-banner__label">{{ label() }}</strong>
      <span class="status-banner__meta">
        @if (timestamp(); as at) {
          {{ metaLead() }}<time [attr.datetime]="at">{{ at | date }}</time>
        } @else {
          {{ emptyText() }}
        }
      </span>
    </div>
    <div class="status-banner__actions"><ng-content /></div>
  `,
  styles: `
    :host {
      --tone: var(--ink-muted);
      --tone-fg: #d8dee7;
      display: flex;
      min-width: 0;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.6rem 0.75rem;
      margin: calc(-1 * var(--status-banner-inset-block, 0px)) calc(-1 * var(--status-banner-inset-inline, 0px)) 0;
      padding: 1rem var(--status-banner-inset-inline, 1rem);
      border-bottom: 1px solid color-mix(in srgb, var(--tone) 28%, transparent);
      background: color-mix(in srgb, var(--tone) 7%, transparent);
    }

    :host([data-tone='good']) { --tone: var(--status-good); --tone-fg: var(--status-good-fg); }
    :host([data-tone='warn']) { --tone: var(--status-warn); --tone-fg: var(--status-warn-fg); }
    :host([data-tone='bad']) {
      --tone: var(--status-bad);
      --tone-fg: var(--status-bad-fg);
      border-bottom-color: color-mix(in srgb, var(--tone) 30%, transparent);
      background: color-mix(in srgb, var(--tone) 8%, transparent);
    }

    .status-banner__icon {
      color: var(--tone);
      font-size: 1.2rem;
    }

    .status-banner__text {
      display: grid;
      min-width: 0;
      flex: 1 1 12rem;
      gap: 0.1rem;
    }

    .status-banner__label {
      color: var(--tone-fg);
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .status-banner__meta {
      overflow: hidden;
      color: var(--detail-muted, rgba(222, 215, 222, 0.59));
      font-size: 0.72rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    time {
      font-family: "Geist Mono", "SFMono-Regular", Consolas, monospace;
      font-size: 0.68rem;
    }

    .status-banner__actions {
      display: flex;
      margin-left: auto;
    }

    .status-banner__actions:empty { display: none; }
  `,
})
export class DetailStatusBannerComponent {
  readonly tone = input<DetailStatusTone>('neutral');
  readonly label = input.required<string>();
  /** When the shown result happened; the banner shows `emptyText` instead when it is missing. */
  readonly timestamp = input<string | null | undefined>();
  readonly timestampPrefix = input('Last checked');
  readonly emptyText = input('');

  private readonly now = signal(Date.now());
  /** e.g. "Last checked 4 min ago · ", followed by the exact time. */
  readonly metaLead = computed(() => {
    const ago = formatTimeAgo(this.timestamp(), this.now());
    return [this.timestampPrefix(), ago].filter(Boolean).join(' ') + ' · ';
  });
  readonly iconName = computed(() => TONE_ICONS[this.tone()]);

  constructor() {
    const clock = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(clock));
  }
}
