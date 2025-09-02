import { Component, OnInit } from '@angular/core';
import {ProgressSpinner} from 'primeng/progressspinner';
import {Card} from 'primeng/card';
import {DatePipe, DecimalPipe, NgClass, NgForOf, NgIf} from '@angular/common';
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
    Chip
  ],
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  dashboardInfo: any = {};

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

  ngOnInit() {
    this.dashboardInfo = { loaded: true };
  }
}
