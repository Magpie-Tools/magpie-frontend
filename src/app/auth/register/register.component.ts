import {HlmButton} from '@spartan-ng/helm/button';
import {HlmInput} from '@spartan-ng/helm/input';
import {getHttpErrorMessage} from '../../shared/http-error';
import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { HttpService } from '../../services/http.service';
import { User } from '../../models/UserModel';
import {saveAuthToken} from '../../services/authorization/auth-token-storage';
import { UserService } from '../../services/authorization/user.service';
import { AuthInterceptor } from '../../services/auth-interceptor.interceptor';
import { NotificationService } from '../../services/notification-service.service';
import { WorkspaceService } from '../../services/workspace.service';
import { passwordPolicyMessages, passwordPolicyValidators } from '../password-policy';
import {AuthComponent} from '../auth.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [HlmButton, HlmInput,
    ReactiveFormsModule,
    RouterLink,

    AuthComponent,
  ],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  registerForm: FormGroup;
  readonly passwordRequirements = passwordPolicyMessages();

  constructor(
    private fb: FormBuilder,
    private http: HttpService,
    private router: Router,
    private user: UserService,
    private notification: NotificationService,
    private workspaces: WorkspaceService,
  ) {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', passwordPolicyValidators()],
      confirmPassword: ['', [Validators.required]]
    });
  }

  onRegister() {
    if (this.registerForm.invalid || !this.passwordIsTheSame()) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.registerForm.value;
    const user: User = { email, password };

    this.http.registerUser(user).subscribe({
      next: (response) => {
        saveAuthToken(response.token, false);
        AuthInterceptor.setToken(response.token);
        this.workspaces.reset();
        UserService.setLoggedIn(true);
        this.user.getAndSetRole();
        this.notification.showSuccess('Registration successful');
        this.router.navigate(['/']);
      },
      error: (error: HttpErrorResponse) => {
        this.notification.showError(`Registration failed: ${getHttpErrorMessage(error)}`);
      }
    });
  }

  passwordIsTheSame() {
    const { password, confirmPassword } = this.registerForm.value;
    return password === confirmPassword;
  }
}
