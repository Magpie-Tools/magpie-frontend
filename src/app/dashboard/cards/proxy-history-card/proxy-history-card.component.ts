import {Component, Input} from '@angular/core';
import {Card} from 'primeng/card';
import {PrimeTemplate} from 'primeng/api';
import {Button} from 'primeng/button';
import {NgForOf, NgStyle, DatePipe, NgIf} from '@angular/common';
import {ProxyCheck} from '../../../models/ProxyCheck';

@Component({
  selector: 'app-proxy-history-card',
  standalone: true,
  imports: [Card, PrimeTemplate, Button, NgForOf, DatePipe, NgStyle, NgIf],
  templateUrl: './proxy-history-card.component.html',
  styleUrl: './proxy-history-card.component.scss'
})
export class ProxyHistoryCardComponent {
  @Input() title = 'Proxy History';
  @Input() history: ProxyCheck[] = [];
  @Input() styleClass = 'transaction-card bg-neutral-900 border border-neutral-800 h-full';

  getStatusIcon(status: string): string {
    switch (status) {
      case 'working':
        return 'pi pi-check-circle';
      case 'failed':
        return 'pi pi-times-circle';
      case 'timeout':
        return 'pi pi-clock';
      default:
        return 'pi pi-question';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'working':
        return this.getAccentColor();
      case 'failed':
        return '#ef4444';
      case 'timeout':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  }

  private getAccentColor(): string {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return '#348566';
    }

    const value = getComputedStyle(document.documentElement).getPropertyValue('--theme-primary-500');
    return value && value.trim().length > 0 ? value.trim() : '#348566';
  }

  formatLatency(latency?: number): string {
    return latency ? `${latency} ms` : '-';
  }
}
