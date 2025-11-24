import {Component, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ProxyListComponent} from './proxy-list/proxy-list.component';

@Component({
    selector: 'app-proxies',
  imports: [
    CommonModule,
    ProxyListComponent,
  ],
    templateUrl: './proxies.component.html',
    styleUrl: './proxies.component.scss'
})
export class ProxiesComponent {
  showNoProxiesMessage = signal(false);
}
