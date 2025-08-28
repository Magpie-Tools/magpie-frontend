import { Component, model } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';

import { User } from '../../models/UserModel';
import { HttpService } from '../../services/http.service';
import { UserService } from '../../services/authorization/user.service';
import { AuthInterceptor } from '../../services/auth-interceptor.interceptor';
import {NotificationService} from '../../services/notification-service.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    CardModule,
    InputTextModule,
    ButtonModule,
    CheckboxModule
  ],
  templateUrl: './login.component.html',
  styleUrl: '../auth.component.scss'
})
export class LoginComponent {
  loginForm: FormGroup;
  rememberPass = model(false);
  shouldRemember = false;

  constructor(private fb: FormBuilder, private http: HttpService, private router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.rememberPass.subscribe(res => (this.shouldRemember = res));
  }

  onLogin() {
    const { email, password } = this.loginForm.value;
    const user: User = { email, password };

    this.http.loginUser(user).subscribe({
      next: (response) => {
        if (this.shouldRemember) {
          localStorage.setItem('magpie-jwt', response.token);
        } else {
          AuthInterceptor.setToken(response.token);
        }
        UserService.setLoggedIn(true);
        UserService.setRole(response.role);
        this.router.navigate(['/']);
      },
      error: (err) => {
        UserService.setLoggedIn(false);
        if (err.status === 401) {
          NotificationService.showError('Username or Password is incorrect');
        } else {
          NotificationService.showError('Something went wrong while login! Error code: ' + err.status)
        }
      },
    });
  }
}
