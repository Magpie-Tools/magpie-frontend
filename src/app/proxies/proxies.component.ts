import {Component} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ProxyListComponent} from './proxy-list/proxy-list.component';
import {AddProxiesComponent} from './add-proxies/add-proxies.component';
import {Button} from 'primeng/button';

@Component({
    selector: 'app-proxies',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    ProxyListComponent,
    AddProxiesComponent,
    Button,
  ],
    templateUrl: './proxies.component.html',
    styleUrl: './proxies.component.scss'
})
export class ProxiesComponent {
  showProxyList: boolean = true;
  showNoProxiesMessage: boolean = false;
}

