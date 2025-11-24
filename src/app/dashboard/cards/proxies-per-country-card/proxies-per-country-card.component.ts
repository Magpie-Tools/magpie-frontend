import {Component, Input} from '@angular/core';
import {Card} from 'primeng/card';
import {PrimeTemplate} from 'primeng/api';
import {NgStyle} from '@angular/common';
import {UIChart} from 'primeng/chart';

interface CountryBreakdown {
  name: string;
  percentage: string | number;
  color?: string;
}

@Component({
  selector: 'app-proxies-per-country-card',
  standalone: true,
  imports: [Card, PrimeTemplate, UIChart, NgStyle],
  templateUrl: './proxies-per-country-card.component.html',
  styleUrl: './proxies-per-country-card.component.scss'
})
export class ProxiesPerCountryCardComponent {
  @Input() title = 'Proxies per country';
  @Input() countries: CountryBreakdown[] = [];
  @Input() chartData: any = {};
  @Input() chartOptions: any = {};
  @Input() styleClass = 'chart-card bg-neutral-900 border border-neutral-800 mb-4';
}
