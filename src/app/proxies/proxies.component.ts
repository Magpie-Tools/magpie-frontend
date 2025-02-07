import {Component} from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatSortModule} from '@angular/material/sort';
import {ProxyListComponent} from './proxy-list/proxy-list.component';
import {AddProxiesComponent} from './add-proxies/add-proxies.component';

@Component({
  selector: 'app-proxies',
  standalone: true,
  imports: [
    MatIcon,
    ReactiveFormsModule,
    FormsModule,
    MatSortModule,
    ProxyListComponent,
    AddProxiesComponent,
  ],
  templateUrl: './proxies.component.html',
  styleUrl: './proxies.component.scss'
})
export class ProxiesComponent {
  showProxyList: boolean = true;
}

