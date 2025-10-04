import {Component, OnInit} from '@angular/core';
import {ProgressSpinner} from 'primeng/progressspinner';
import {NgIf, DecimalPipe} from '@angular/common';
import {ProxyCheck} from '../models/ProxyCheck';
import {KpiCardComponent} from './cards/kpi-card/kpi-card.component';
import {ProxiesPerHourCardComponent} from './cards/proxies-per-hour-card/proxies-per-hour-card.component';
import {ProxyHistoryCardComponent} from './cards/proxy-history-card/proxy-history-card.component';
import {ProxiesPerCountryCardComponent} from './cards/proxies-per-country-card/proxies-per-country-card.component';
import {ProxiesByAnonymityCardComponent} from './cards/proxies-by-anonymity-card/proxies-by-anonymity-card.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [
    ProgressSpinner,
    NgIf,
    DecimalPipe,
    KpiCardComponent,
    ProxiesPerHourCardComponent,
    ProxyHistoryCardComponent,
    ProxiesPerCountryCardComponent,
    ProxiesByAnonymityCardComponent
  ],
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  dashboardInfo: any = {};
  proxiesLineData: any;
  proxiesLineOptions: any;
  majorCountries: Array<{ name: string; value: number; color?: string; percentage: string }> = [];

  anonymitySummary!: { total: number; change: number };
  anonymitySegments!: Array<{
    name: string;
    count: number;
    change: number;
    share: number;
    barClass: string;
    dotColor: string;
  }>;

  conversionRate = {
    value: 10,
    history: [8.6, 9.1, 9.8, 10.06]
  };

  avgOrderValue = {
    value: 306,
    history: [280, 288, 297, 294]
  };

  orderQuantity = {
    value: 1620,
    history: [1400, 1520, 1680, 1655]
  };

  proxyData = {
    current: 620076,
    avg: 1120,
    growth: 'PROXIES',
    avgLabel: 'Checks Per Second'
  };

  visitorPieData = {
    labels: ['United States', 'Germany', 'India', 'Brazil', 'Austria'],
    datasets: [
      {
        data: [320000, 95000, 72000, 54000, 38000],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
        hoverBackgroundColor: ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed']
      }
    ]
  };

  pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#e5e7eb'
        }
      }
    }
  };

  proxyHistory: ProxyCheck[] = [
    {
      id: '#1',
      ip: '192.168.1.101:8080',
      status: 'working',
      latency: 120,
      date: new Date('2025-09-01T12:05:00'),
      time: '12:05 PM'
    },
    {
      id: '#2',
      ip: '192.168.1.102:8080',
      status: 'failed',
      date: new Date('2025-09-01T12:03:00'),
      time: '12:03 PM'
    },
    {
      id: '#3',
      ip: '192.168.1.103:8080',
      status: 'timeout',
      date: new Date('2025-09-01T11:55:00'),
      time: '11:55 AM'
    },
    {
      id: '#4',
      ip: '192.168.1.104:8080',
      status: 'working',
      latency: 85,
      date: new Date('2025-09-01T11:50:00'),
      time: '11:50 AM'
    }
  ];

  ngOnInit(): void {
    this.dashboardInfo = { loaded: true };

    const anonRaw = [
      { name: 'Elite', count: 780_000, change: 0.12, barClass: 'bg-blue-500/70', dotColor: '#60a5fa' },
      { name: 'Anonymous', count: 636_000, change: -0.16, barClass: 'bg-orange-500/70', dotColor: '#f59e0b' },
      { name: 'Transparent', count: 356_480, change: 0.05, barClass: 'bg-slate-300/70', dotColor: '#cbd5e1' }
    ];

    const values = this.visitorPieData.datasets[0].data;
    const labels = this.visitorPieData.labels;
    const colors = this.visitorPieData.datasets[0].backgroundColor;
    const total = anonRaw.reduce((a, b) => a + b.count, 0);

    this.anonymitySegments = anonRaw.map(s => ({ ...s, share: s.count / total }));

    this.anonymitySummary = {
      total,
      change: 0.64
    };

    const combined = labels.map((name: string, i: number) => ({
      name,
      value: values[i],
      color: colors[i]
    })).sort((a, b) => b.value - a.value);

    const top = combined.slice(0, 4);
    const othersValue = combined.slice(4).reduce((a, b) => a + b.value, 0);

    if (othersValue > 0) {
      top.push({ name: 'Others', value: othersValue, color: '#6b7280' });
    }

    this.majorCountries = top.map(c => ({
      ...c,
      percentage: ((c.value / total) * 100).toFixed(1)
    }));

    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const proxies = [50, 52, 54, 58, 61, 65, 63, 70, 72, 74, 76, 80, 85, 83, 82, 84, 88, 92, 95, 97, 98, 99, 100, 100];
    const gained = [0, 2, 2, 4, 3, 4, -2, 7, 2, 2, 2, 4, 5, -2, -1, 2, 4, 4, 3, 2, 1, 1, 1, 0];
    const lost = gained.map(v => (v < 0 ? Math.abs(v) : 0));
    const limit = 100;

    this.proxiesLineData = {
      labels: hours,
      datasets: [
        {
          label: 'Proxies',
          data: proxies,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Proxy Limit',
          data: Array(hours.length).fill(limit),
          borderColor: '#f59e0b',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    };

    this.proxiesLineOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const index = context.dataIndex;
              const value = context.dataset.data[index];
              const g = gained[index] || 0;
              const l = lost[index] || 0;
              if (context.dataset.label === 'Proxies') {
                return `Proxies: ${value} (Gained: ${g}, Lost: ${l})`;
              }
              return `Limit: ${value}`;
            }
          }
        },
        legend: {
          labels: { color: '#e5e7eb' }
        }
      },
      scales: {
        x: {
          ticks: { color: '#9ca3af' },
          grid: { color: '#374151' }
        },
        y: {
          ticks: { color: '#9ca3af' },
          grid: { color: '#374151' }
        }
      }
    };
  }
}
