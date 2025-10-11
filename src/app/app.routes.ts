import { Routes } from '@angular/router';
import {DashboardComponent} from './dashboard/dashboard.component';
import {ProxiesComponent} from './proxies/proxies.component';
import {ProxyDetailComponent} from './proxies/proxy-detail/proxy-detail.component';
import {RegisterComponent} from './auth/register/register.component';
import {LoginComponent} from './auth/login/login.component';
import {AuthGuardService} from './services/authorization/auth-guard.service';
import {AccountComponent} from './account/account.component';
import {AuthGuardAdminService} from './services/authorization/auth-guard-admin.service';
import {AdminCheckerComponent} from './checker/admin-checker/admin-checker.component';
import {AdminScraperComponent} from './scraper/admin-scraper/admin-scraper.component';
import {UserScraperComponent} from './scraper/user-scraper/user-scraper.component';
import {AuthLoginGuardService} from './services/authorization/auth-login-guard.service';
import {AddProxiesComponent} from './proxies/proxy-list/add-proxies/add-proxies.component';
import {CheckerJudgesComponent} from './checker/judges/checker-judges.component';
import {CheckerSettingsComponent} from './checker/settings/checker-settings.component';

export const routes: Routes = [
  {path: "account", component: AccountComponent, canActivate: [AuthGuardService]},
  {path: "addProxies", component: AddProxiesComponent, canActivate: [AuthGuardService]},
  {path: "proxies", component: ProxiesComponent, canActivate: [AuthGuardService]},
  {path: "proxies/:id", component: ProxyDetailComponent, canActivate: [AuthGuardService]},
  {path: "checker", redirectTo: "checker/settings", pathMatch: "full"},
  {path: "checker/settings", component: CheckerSettingsComponent, canActivate: [AuthGuardService]},
  {path: "checker/judges", component: CheckerJudgesComponent, canActivate: [AuthGuardService]},
  {path: "global/checker", component: AdminCheckerComponent, canActivate: [AuthGuardAdminService]},
  {path: "scraper", component: UserScraperComponent, canActivate: [AuthGuardService]},
  {path: "global/scraper", component: AdminScraperComponent, canActivate: [AuthGuardAdminService]},
  {path: "register", component: RegisterComponent, canActivate: [AuthLoginGuardService]},
  {path: "login", component: LoginComponent, canActivate: [AuthLoginGuardService]},
  {path: "**", component: DashboardComponent, canActivate: [AuthGuardService]}
];
