import {HlmButton} from '@spartan-ng/helm/button';
import {HlmCardImports} from '@spartan-ng/helm/card';
import {Component, EventEmitter, inject, Input, LOCALE_ID, Output} from '@angular/core';
import {formatNumber} from '@angular/common';

import {NgStyle, DatePipe} from '@angular/common';
import {ProxyCheck} from '../../../models/ProxyCheck';
import {splitHostPort} from '../../../shared/proxy-address';

@Component({
  selector: 'app-proxy-history-card',
  standalone: true,
  imports: [HlmButton, HlmCardImports, DatePipe, NgStyle],
  templateUrl: './proxy-history-card.component.html',
  styleUrl: './proxy-history-card.component.scss'
})
export class ProxyHistoryCardComponent {
  @Input() title = 'Recent checks';
  @Input() history: ProxyCheck[] = [];
  @Input() styleClass = 'dashboard-card history-card';
  @Input() refreshing = false;
  @Output() refresh = new EventEmitter<void>();

  protected readonly splitAddress = splitHostPort;
  private readonly locale = inject(LOCALE_ID);

  onRefreshClick(): void {
    if (this.refreshing) {
      return;
    }

    this.refresh.emit();
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'working':
        return 'icon icon-circle-check';
      case 'failed':
        return 'icon icon-circle-x';
      case 'timeout':
        return 'icon icon-clock';
      default:
        return 'icon icon-circle-help';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'working':
        return '#10b981';
      case 'failed':
        return '#ef4444';
      case 'timeout':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  }

  formatLatency(latency?: number): string {
    return latency ? `${formatNumber(latency, this.locale)} ms` : '-';
  }
}
