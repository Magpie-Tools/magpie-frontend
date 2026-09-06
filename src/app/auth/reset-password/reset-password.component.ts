import {getHttpErrorMessage} from '../../shared/http-error';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { HttpService } from '../../services/http.service';
import { NotificationService } from '../../services/notification-service.service';
import { passwordPolicyMessages, passwordPolicyValidators } from '../password-policy';
import {AuthComponent} from '../auth.component';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputTextModule,
    ButtonModule,
    AuthComponent,
  ],
  templateUrl: './reset-password.component.html'
})
export class ResetPasswordComponent {
  resetPasswordForm: FormGroup;
  token: string;
  readonly passwordRequirements = passwordPolicyMessages();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpService,
    private notification: NotificationService,
  ) {
    this.token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';
    this.resetPasswordForm = this.fb.group({
      password: ['', passwordPolicyValidators()],
      confirmPassword: ['', [Validators.required]],
    });
  }

  passwordsMatch() {
    const { password, confirmPassword } = this.resetPasswordForm.value;
    return password === confirmPassword;
  }

  onSubmit() {
    if (!this.token) {
      this.notification.showError('The password reset link is missing a token.');
      return;
    }

    if (this.resetPasswordForm.invalid || !this.passwordsMatch()) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    const password = this.resetPasswordForm.value.password as string;
    this.http.resetPasswordWithToken({
      token: this.token,
      newPassword: password,
    }).subscribe({
      next: (response) => {
        this.notification.showSuccess(response.message);
        this.router.navigate(['/login']);
      },
      error: (error: HttpErrorResponse) => {
        this.notification.showError(`Could not reset password: ${getHttpErrorMessage(error)}`);
      }
    });
  }
}
