import { Routes } from '@angular/router';
import {DashboardComponent} from './dashboard/dashboard.component';
import {CheckerComponent} from './checker/checker.component';
import {ScraperComponent} from './scraper/scraper.component';
import {ProxiesComponent} from './proxies/proxies.component';
import {RegisterComponent} from './auth/register/register.component';
import {LoginComponent} from './auth/login/login.component';
import {AuthGuardService} from './services/authorization/auth-guard.service';
import {AccountComponent} from './account/account.component';

export const routes: Routes = [
  {path: "account", component: AccountComponent, canActivate: [AuthGuardService]},
  {path: "proxies", component: ProxiesComponent, canActivate: [AuthGuardService]},
  {path: "checker", component: CheckerComponent, canActivate: [AuthGuardService]},
  {path: "scraper", component: ScraperComponent, canActivate: [AuthGuardService]},
  {path: "register", component: RegisterComponent},
  {path: "login", component: LoginComponent},
  {path: "**", component: DashboardComponent, canActivate: [AuthGuardService]}
];
