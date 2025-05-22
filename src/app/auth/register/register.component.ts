import { Component } from '@angular/core';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatInput} from '@angular/material/input';
import {MatButton} from '@angular/material/button';
import {Router, RouterLink} from '@angular/router';
import {MatCard} from '@angular/material/card';
import {HttpService} from '../../services/http.service';
import {User} from '../../models/userModel';
import {UserService} from '../../services/authorization/user.service';
import {SnackbarService} from '../../services/snackbar.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    MatLabel,
    MatFormField,
    ReactiveFormsModule,
    MatInput,
    MatButton,
    RouterLink,
    MatCard
  ],
  templateUrl: './register.component.html',
  styleUrl: '../auth.component.scss'
})
export class RegisterComponent {
  registerForm: FormGroup;

  constructor(private fb: FormBuilder, private http: HttpService, private router: Router, private user: UserService) {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    });
  }

  onRegister() {
    if (this.registerForm.valid) {
      const { email, password, confirmPassword } = this.registerForm.value;

      if (!this.passwordIsTheSame() || password.length < 8) {
        return;
      }

      // Create a User object
      const user: User = { email, password };

      // Send the data to the backend
      this.http.registerUser(user).subscribe({
        next: (response) => {
          localStorage.setItem('magpie-jwt', response.token);
          UserService.setLoggedIn(true)
          this.user.getAndSetRole()
          SnackbarService.openSnackbar("Registration successful", 3000)
          this.router.navigate(['/']);
        },
        error: (error) => console.error('Registration failed', error),
      });
    }
  }

  passwordIsTheSame() {
    const { email, password, confirmPassword } = this.registerForm.value;
    return password == confirmPassword;
  }
}
