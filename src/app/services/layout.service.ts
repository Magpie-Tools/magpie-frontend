import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly sidebarOpen = signal(true);
  toggleSidebar() { this.sidebarOpen.update(v => !v); }
  setSidebar(open: boolean) { this.sidebarOpen.set(open); }
}
