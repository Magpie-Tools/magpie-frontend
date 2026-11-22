import {DatePipe, DecimalPipe} from '@angular/common';
import {Component, computed, DestroyRef, inject, input, signal} from '@angular/core';
import {ProxyProtocolHealth} from '../../../models/ProxyDetail';
import {formatTimeAgo} from '../../../shared/time-ago';

/** Ticks per protocol; the backend sends up to this many recent verdicts. */
const RECENT_SLOTS = 20;

type Tick = 'up' | 'down' | 'none';

interface ProtocolCell {
  key: string;
  /** e.g. "HTTPS", or "HTTPS · QUIC" when the check did not use TCP. */
  label: string;
  alive: boolean;
  responseTime: number;
  checkedAt: string;
  ticks: Tick[];
  /** Accessible summary of the ticks, e.g. "Last 20 checks: 3 failed". */
  ticksLabel: string;
}

/**
 * Header band of the proxy overview: one cell per checked protocol with its latest verdict, latency,
 * how long ago it was checked, and its recent checks as ticks (oldest first, padded at the start).
 * The host bleeds to the panel edges when the panel sets --protocol-health-inset-block / -inline.
 */
@Component({
  selector: 'app-proxy-protocol-health',
  imports: [DatePipe, DecimalPipe],
  host: {
    'class': 'protocol-health',
    '[style.--protocol-count]': 'cells().length || 1',
  },
  template: `
    @for (cell of cells(); track cell.key) {
      <div class="protocol-health__cell" role="group" [attr.aria-label]="cell.label">
        <span class="protocol-health__protocol">{{ cell.label }}</span>
        <strong class="protocol-health__state" [class.protocol-health__state--down]="!cell.alive">
          <span class="protocol-health__dot" aria-hidden="true"></span>{{ cell.alive ? "Alive" : "Dead" }}
        </strong>
        <span class="protocol-health__meta">
          @if (cell.alive) {
            <span class="protocol-health__ms">{{ cell.responseTime | number }} ms</span> ·
          } @else {
            Failed ·
          }
          <time [attr.datetime]="cell.checkedAt" [title]="cell.checkedAt | date: 'medium'">{{ timeAgo(cell.checkedAt) }}</time>
        </span>
        <span class="protocol-health__ticks" role="img" [attr.aria-label]="cell.ticksLabel" [title]="cell.ticksLabel">
          @for (tick of cell.ticks; track $index) {
            <i [class]="'protocol-health__tick protocol-health__tick--' + tick"></i>
          }
        </span>
      </div>
    } @empty {
      <div class="protocol-health__cell" role="status">
        <span class="protocol-health__protocol">Protocols</span>
        <strong class="protocol-health__state protocol-health__state--none">
          <span class="protocol-health__dot" aria-hidden="true"></span>Not checked
        </strong>
        <span class="protocol-health__meta">No check results yet</span>
      </div>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(var(--protocol-count), minmax(0, 1fr));
      margin: calc(-1 * var(--protocol-health-inset-block, 0px)) calc(-1 * var(--protocol-health-inset-inline, 0px)) 0;
      padding: 0 var(--protocol-health-inset-inline, 1rem);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      container-type: inline-size;
    }

    .protocol-health__cell {
      display: grid;
      min-width: 0;
      align-content: start;
      padding: 1rem 1rem 1rem 0;
    }

    .protocol-health__cell + .protocol-health__cell {
      padding-left: 1rem;
      border-left: 1px solid rgba(255, 255, 255, 0.08);
    }

    .protocol-health__protocol {
      overflow: hidden;
      color: var(--detail-muted, rgba(222, 215, 222, 0.59));
      font-size: 0.68rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .protocol-health__state {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.3rem;
      color: var(--status-good-fg);
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .protocol-health__dot {
      width: 0.5rem;
      height: 0.5rem;
      flex: none;
      border-radius: 50%;
      background: var(--status-good);
    }

    .protocol-health__state--down { color: var(--status-bad-text); }
    .protocol-health__state--down .protocol-health__dot { background: var(--status-bad); }
    .protocol-health__state--none { color: var(--detail-muted, rgba(222, 215, 222, 0.59)); }
    .protocol-health__state--none .protocol-health__dot {
      background: transparent;
      box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.28);
    }

    .protocol-health__meta {
      margin-top: 0.15rem;
      overflow: hidden;
      color: var(--detail-muted, rgba(222, 215, 222, 0.59));
      font-size: 0.7rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .protocol-health__ms {
      font-family: "Geist Mono", "SFMono-Regular", Consolas, monospace;
    }

    .protocol-health__ticks {
      display: flex;
      gap: 2px;
      margin-top: 0.6rem;
    }

    .protocol-health__tick {
      height: 0.55rem;
      min-width: 2px;
      flex: 1 1 0;
      border-radius: 1.5px;
    }

    .protocol-health__tick--up { background: color-mix(in srgb, var(--status-good) 65%, transparent); }
    .protocol-health__tick--down { background: color-mix(in srgb, var(--status-bad) 85%, transparent); }
    .protocol-health__tick--none { background: rgba(255, 255, 255, 0.06); }

    /* Narrow panels: two cells per row, dividers between columns and rows. */
    @container (max-width: 34rem) {
      :host {
        grid-template-columns: repeat(min(var(--protocol-count), 2), minmax(0, 1fr));
      }

      .protocol-health__cell,
      .protocol-health__cell + .protocol-health__cell {
        padding: 0.85rem 0.85rem 0.85rem 0;
        border-left: 0;
      }

      .protocol-health__cell:nth-child(even) {
        padding-left: 0.85rem;
        border-left: 1px solid rgba(255, 255, 255, 0.08);
      }

      .protocol-health__cell:nth-child(n + 3) {
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }
    }
  `,
})
export class ProxyProtocolHealthComponent {
  readonly protocols = input<readonly ProxyProtocolHealth[]>([]);

  readonly cells = computed<ProtocolCell[]>(() => this.protocols().map(protocol => {
    const name = (protocol.protocol || 'Unknown').toUpperCase();
    const transport = (protocol.transport || '').toLowerCase();
    const recent = (protocol.recent ?? []).slice(-RECENT_SLOTS);
    const ticks: Tick[] = [
      ...Array<Tick>(RECENT_SLOTS - recent.length).fill('none'),
      ...recent.map((alive): Tick => alive ? 'up' : 'down'),
    ];
    const failed = recent.filter(alive => !alive).length;
    const ticksLabel = recent.length
      ? `Last ${recent.length} ${recent.length === 1 ? 'check' : 'checks'}: ${failed ? `${failed} failed` : 'all passed'}`
      : 'No earlier checks with the current settings';
    return {
      key: `${name}-${transport}`,
      label: transport && transport !== 'tcp' ? `${name} · ${transport.toUpperCase()}` : name,
      alive: protocol.alive,
      responseTime: protocol.response_time,
      checkedAt: protocol.checked_at,
      ticks,
      ticksLabel,
    };
  }));

  private readonly now = signal(Date.now());

  constructor() {
    const clock = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(clock));
  }

  timeAgo(at: string): string {
    return formatTimeAgo(at, this.now()) ?? '';
  }
}
