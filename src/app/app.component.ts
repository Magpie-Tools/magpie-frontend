import {Component} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {NavbarComponent} from './navbar/navbar.component';
import {DomSanitizer} from '@angular/platform-browser';
import {MatIconRegistry} from '@angular/material/icon';
import {UserService} from './services/authorization/user.service';
import {SnackbarService} from './services/snackbar.service';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, NavbarComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent{
  title = 'Magpie';

  constructor(
    iconRegistry: MatIconRegistry,
              sanitizer: DomSanitizer,
              private snackBar: SnackbarService,
            ){
    iconRegistry.addSvgIconSet(
      sanitizer.bypassSecurityTrustResourceUrl('assets/icons/iconset.svg')
    );
  }

  protected readonly UserService = UserService;
}
