import {HlmButton} from '@spartan-ng/helm/button';
import {HlmCardImports} from '@spartan-ng/helm/card';
import {Component, EventEmitter, Input, Output} from '@angular/core';

import {NgStyle, DatePipe} from '@angular/common';
import {ProxyCheck} from '../../../models/ProxyCheck';

@Component({
  selector: 'app-proxy-history-card',
  standalone: true,
  imports: [HlmButton, HlmCardImports, DatePipe, NgStyle],
  templateUrl: './proxy-history-card.component.html',
  styleUrl: './proxy-history-card.component.scss'
})
export class ProxyHistoryCardComponent {
  @Input() title = 'Proxy History';
  @Input() history: ProxyCheck[] = [];
  @Input() styleClass = 'dashboard-card history-card';
  @Input() refreshing = false;
  @Output() refresh = new EventEmitter<void>();

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
    return latency ? `${latency} ms` : '-';
  }
}
