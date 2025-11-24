import {Component, Input} from '@angular/core';
import {Card} from 'primeng/card';
import {PrimeTemplate} from 'primeng/api';
import {NgClass, NgStyle, DecimalPipe} from '@angular/common';

interface AnonymitySummary {
  total: number;
  change: number;
}

interface AnonymitySegment {
  name: string;
  count: number;
  change: number;
  share: number;
  barClass: string;
  dotColor: string;
}

@Component({
  selector: 'app-proxies-by-anonymity-card',
  standalone: true,
  imports: [Card, PrimeTemplate, NgClass, NgStyle, DecimalPipe],
  templateUrl: './proxies-by-anonymity-card.component.html',
  styleUrl: './proxies-by-anonymity-card.component.scss'
})
export class ProxiesByAnonymityCardComponent {
  @Input() title = 'Proxies by Anonymity';
  @Input() summary?: AnonymitySummary;
  @Input() segments: AnonymitySegment[] = [];
  @Input() styleClass = 'chart-card bg-neutral-900 border border-neutral-800';

  getHeight(share: number): string {
    const min = 0.08;
    return `${Math.max(share, min) * 100}%`;
  }
}
