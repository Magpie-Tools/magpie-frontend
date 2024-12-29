import { Routes } from '@angular/router';
import {LicenseComponent} from './license/license.component';
import {DashboardComponent} from './dashboard/dashboard.component';
import {CheckerComponent} from './checker/checker.component';
import {ScraperComponent} from './scraper/scraper.component';
import {ProxiesComponent} from './proxies/proxies.component';

export const routes: Routes = [
  {path: "license", component: LicenseComponent},
  {path: "proxies", component: ProxiesComponent},
  {path: "checker", component: CheckerComponent},
  {path: "scraper", component: ScraperComponent},
  {path: "**", component: DashboardComponent}
];
