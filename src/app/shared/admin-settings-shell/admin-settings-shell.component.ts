import {Component, ViewEncapsulation} from '@angular/core';

@Component({
  selector: 'app-admin-settings-shell',
  standalone: true,
  template: '<ng-content></ng-content>',
  styleUrl: './admin-settings-shell.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AdminSettingsShellComponent {}
