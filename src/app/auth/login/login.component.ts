import {Component, model} from '@angular/core';
import {MatFormField, MatLabel} from "@angular/material/form-field";
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {MatButton} from "@angular/material/button";
import {Router, RouterLink} from "@angular/router";
import {MatCard} from "@angular/material/card";
import {MatInput} from "@angular/material/input";
import {User} from '../../models/UserModel';
import {HttpService} from '../../services/http.service';
import {UserService} from '../../services/authorization/user.service';
import {SnackbarService} from '../../services/snackbar.service';
import {MatCheckbox} from '@angular/material/checkbox';
import {AuthInterceptor} from '../../services/auth-interceptor.interceptor';

@Component({
    selector: 'app-login',
    imports: [
        MatLabel,
        MatFormField,
        ReactiveFormsModule,
        MatButton,
        RouterLink,
        MatCard,
        MatInput,
        MatCheckbox,
        FormsModule
    ],
    templateUrl: './login.component.html',
    styleUrl: '../auth.component.scss'
})
export class LoginComponent {
  loginForm: FormGroup;
  rememberPass = model(false);
  shouldRemember: boolean = false;


  constructor(private fb: FormBuilder, private http: HttpService, private router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.rememberPass.subscribe(res => this.shouldRemember = res)
  }

  onLogin() {
    const { email, password } = this.loginForm.value;
    const user: User = { email, password };
    this.http.loginUser(user).subscribe({
      next: (response) => {
        if (this.shouldRemember) {
          localStorage.setItem('magpie-jwt', response.token);
        } else {
          AuthInterceptor.setToken(response.token)
        }
        UserService.setLoggedIn(true)
        UserService.setRole(response.role)
        this.router.navigate(["/"])
      },
      error: (err) => {
        UserService.setLoggedIn(false)
        if (err.status === 401) {
          SnackbarService.openSnackbarDefault("Username or Password is incorrect")
        } else {
          SnackbarService.openSnackbarDefault("Something went wrong while login! Error code: " + err.status)
        }
      }
    })
  }
}
