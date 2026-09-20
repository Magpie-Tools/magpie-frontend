import {Component, input} from '@angular/core';
import {scrapeStatusLabel} from '../../models/ScrapeSourceStatus';

@Component({
  selector: 'app-source-scrape-status',
  template: `<span class="scrape-status" [attr.data-status]="status() || 'pending'">
    <span class="scrape-status__dot" aria-hidden="true"></span>{{ statusLabel(status()) }}
  </span>`,
  styles: `
    :host { display: inline-flex; min-width: 0; }
    .scrape-status {
      display: inline-flex;
      align-items: center;
      gap: var(--scrape-status-gap, .38rem);
      color: var(--scrape-status-text-color, rgba(255, 255, 255, .68));
      font-size: var(--scrape-status-font-size, .6rem);
      font-weight: var(--scrape-status-font-weight, inherit);
      line-height: 1.5;
    }
    .scrape-status__dot {
      width: var(--scrape-status-dot-size, .3rem);
      height: var(--scrape-status-dot-size, .3rem);
      flex: 0 0 auto;
      border-radius: 50%;
      background: #8a94a3;
    }
    [data-status="success"] .scrape-status__dot {
      background: #25cf7a;
      box-shadow: 0 0 .7rem rgba(37, 207, 122, .5);
    }
    [data-status="error"] .scrape-status__dot { background: #f06d76; }
    [data-status="blocked"] .scrape-status__dot,
    [data-status="empty"] .scrape-status__dot { background: #e2ba55; }
  `,
})
export class SourceScrapeStatusComponent {
  readonly status = input<string>();
  readonly statusLabel = scrapeStatusLabel;
}
