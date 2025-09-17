import { Component, OnInit } from '@angular/core';
import {ProgressSpinner} from 'primeng/progressspinner';
import {Card} from 'primeng/card';
import {DatePipe, DecimalPipe, NgClass, NgForOf, NgIf, NgStyle} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {UIChart} from 'primeng/chart';
import {Button} from 'primeng/button';
import {PrimeTemplate} from 'primeng/api';
import {Chip} from 'primeng/chip';
import {ProxyCheck} from '../models/ProxyCheck';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [
    ProgressSpinner,
    Card,
    NgClass,
    DecimalPipe,
    FormsModule,
    UIChart,
    Button,
    DatePipe,
    PrimeTemplate,
    NgIf,
    NgForOf,
    Chip,
    NgStyle
  ],
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  dashboardInfo: any = {};
  proxiesLineData: any;
  proxiesLineOptions: any;
  majorCountries: any[] = [];

  anonymitySummary!: { total: number; change: number };
  anonymitySegments!: Array<{
    name: string;
    count: number;
    change: number;           // delta vs. last period (for arrows)
    share: number;            // computed
    barClass: string;         // Tailwind bg-*
    dotColor: string;         // small top dot color
  }>;

  // KPI Data
  conversionRate = {
    value: 0.81,
    change: -0.6,
    isPositive: false
  };

  avgOrderValue = {
    value: 306.2,
    change: 4.2,
    isPositive: true
  };

  orderQuantity = {
    value: 1620,
    change: -2.1,
    isPositive: false
  };

  // Chart data for unique visitors
  proxyData = {
    current: 620076,
    avg: 1120,
    growth: 'PROXIES',
    avgLabel: 'Checks Per Second'
  };

  // Revenue chart data
  // Pie chart data for unique visitors by country
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
          color: '#e5e7eb' // light text for dark background
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

  ngOnInit() {
    this.dashboardInfo = { loaded: true };

    const anonRaw = [
      { name: 'Elite',       count: 780_000, change:  0.12, barClass: 'bg-blue-500/70',   dotColor: '#60a5fa' },
      { name: 'Anonymous',   count: 636_000, change: -0.16, barClass: 'bg-orange-500/70', dotColor: '#f59e0b' },
      { name: 'Transparent', count: 356_480, change:  0.05, barClass: 'bg-slate-300/70',  dotColor: '#cbd5e1' }
    ];


    // Total count of proxies
    const values = this.visitorPieData.datasets[0].data;
    const labels = this.visitorPieData.labels;
    const colors = this.visitorPieData.datasets[0].backgroundColor;
    const total = anonRaw.reduce((a, b) => a + b.count, 0);
    this.anonymitySegments = anonRaw.map(s => ({ ...s, share: s.count / total }));

    this.anonymitySummary = {
      total,
      change: 0.64 // +64% overall (just demo)
    };
    // Sort by biggest
    const combined = labels.map((name: string, i: number) => ({
      name,
      value: values[i],
      color: colors[i]
    })).sort((a, b) => b.value - a.value);

    // Take top 5
    const top = combined.slice(0, 4);
    const othersValue = combined.slice(4).reduce((a, b) => a + b.value, 0);

    if (othersValue > 0) {
      top.push({ name: 'Others', value: othersValue, color: '#6b7280' });
    }

    // Calculate percentages
    this.majorCountries = top.map(c => ({
      ...c,
      percentage: ((c.value / total) * 100).toFixed(1)
    }));

    // Mock hourly data for last 7 days (simplified to 24 points)
    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const proxies = [50, 52, 54, 58, 61, 65, 63, 70, 72, 74, 76, 80, 85, 83, 82, 84, 88, 92, 95, 97, 98, 99, 100, 100];
    const gained = [0, 2, 2, 4, 3, 4, -2, 7, 2, 2, 2, 4, 5, -2, -1, 2, 4, 4, 3, 2, 1, 1, 1, 0];
    const lost = gained.map(v => (v < 0 ? Math.abs(v) : 0));
    const limit = 100; // max proxies allowed

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

  getStatusIcon(status: string): string {
    switch (status) {
      case 'working': return 'pi pi-check-circle';
      case 'failed': return 'pi pi-times-circle';
      case 'timeout': return 'pi pi-clock';
      default: return 'pi pi-question';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'working': return '#10b981'; // green
      case 'failed': return '#ef4444';  // red
      case 'timeout': return '#f59e0b'; // orange
      default: return '#6b7280';
    }
  }

  formatLatency(latency?: number): string {
    return latency ? `${latency} ms` : '-';
  }



  getChangeColorClass(change: number): string {
    if (change > 2) {
      return 'text-green-400'; // green
    } else if (change < -2) {
      return 'text-red-400'; // red
    } else {
      return 'text-blue-400'; // neutral
    }
  }

  getChipClass(change: number): string {
    if (change > 2) {
      return '!bg-green-500/20 !text-green-400';
    } else if (change < -2) {
      return '!bg-red-500/20 !text-red-400';
    } else {
      return '!bg-blue-500/20 !text-blue-400';
    }
  }


  getHeight(share: number): string {
    // keep a pleasant minimum height so tiny categories still show
    const min = 0.08;
    return `${Math.max(share, min) * 100}%`;
  }
}
