import { Component, Signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';

import { ReactiveFormsModule } from '@angular/forms';
import {HttpService} from '../services/http.service';
import {ChangePassword} from '../models/ChangePassword';
import {Button} from 'primeng/button';
import {NotificationService} from '../services/notification-service.service';

import {ThemeService, ThemeName} from '../services/theme.service';
import {Password} from 'primeng/password';

@Component({
    selector: 'app-account',
  imports: [
    ReactiveFormsModule,
    Button,
    Password,
  ],
    templateUrl: './account.component.html',
    styleUrls: ['./account.component.scss']
})
export class AccountComponent {
  passwordForm: FormGroup;
  readonly themes: ThemeName[];
  readonly currentTheme: Signal<ThemeName>;
  private readonly themeLabels: Record<ThemeName, string> = {
    green: 'Green',
    blue: 'Blue',
    red: 'Red'
  };

  private readonly themePreviewColors: Record<ThemeName, string> = {
    green: '#348566',
    blue: '#3b82f6',
    red: '#dc2626'
  };

  constructor(private fb: FormBuilder,
              private http: HttpService,
              private themeService: ThemeService) {
    this.passwordForm = this.fb.group(
      {
        oldPassword: ['', [Validators.required]],
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        newPasswordCheck: ['', [Validators.required]],
      },
      { validators: this.passwordsMatchValidator }
    );

    this.themes = this.themeService.themes;
    this.currentTheme = this.themeService.theme;
  }

  setTheme(theme: ThemeName): void {
    this.themeService.setTheme(theme);
  }

  labelFor(theme: ThemeName): string {
    return this.themeLabels[theme];
  }

  colorFor(theme: ThemeName): string {
    return this.themePreviewColors[theme];
  }

  passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
    const newPass = group.get('newPassword')?.value;
    const newPassCheck = group.get('newPasswordCheck')?.value;
    return newPass && newPassCheck && newPass === newPassCheck
      ? null
      : { passwordsMismatch: true };
  }

  onSubmit(): void {
    if (this.passwordForm.valid) {

      const changePass: ChangePassword = this.passwordForm.value

      this.http.changePassword(changePass).subscribe({
        next:  res  => NotificationService.showInfo(res),
        error: err => NotificationService.showError("There has been an error while changing the password! " + err.error.message)
      });

      // this.passwordForm.reset();
    } else {
      this.passwordForm.markAllAsTouched();
    }
  }
}
