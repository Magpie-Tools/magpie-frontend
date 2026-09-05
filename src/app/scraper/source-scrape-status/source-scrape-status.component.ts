import {Component, input} from '@angular/core';
import {scrapeStatusLabel} from '../../models/ScrapeSourceStatus';

@Component({
  selector: 'app-source-scrape-status',
  template: `<span class="scrape-status" [attr.data-status]="status() || 'pending'">
    <span class="scrape-status__dot" aria-hidden="true"></span>{{ statusLabel(status()) }}
  </span>`,
  styles: `
    :host { display: inline-flex; min-width: 0; }
    .scrape-status { display: inline-flex; align-items: center; gap: .38rem; color: rgba(255,255,255,.46); font-size: .6rem; line-height: 1.5; }
    .scrape-status__dot { width: .3rem; height: .3rem; flex: 0 0 auto; border-radius: 50%; background: currentColor; }
    [data-status="success"] { color: var(--theme-primary-200); }
    [data-status="error"] { color: #e8a0a6; }
    [data-status="blocked"], [data-status="empty"] { color: #d5bb8f; }
  `,
})
export class SourceScrapeStatusComponent {
  readonly status = input<string>();
  readonly statusLabel = scrapeStatusLabel;
}
