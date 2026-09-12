import {HlmCardImports} from '@spartan-ng/helm/card';
import {Component, Input, ViewEncapsulation} from '@angular/core';
import {RouterLink} from '@angular/router';

import {ThemeService} from '../services/theme.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [HlmCardImports, RouterLink],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AuthComponent {
  @Input({required: true}) title = '';

  constructor(protected readonly themeService: ThemeService) {}
}
