import { Component } from '@angular/core';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatInput} from '@angular/material/input';
import {MatButton} from '@angular/material/button';
import {RouterLink} from '@angular/router';
import {MatCard} from '@angular/material/card';
import {HttpService} from '../../services/http.service';
import {User} from '../../models/userModel';

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

  constructor(private fb: FormBuilder, private http: HttpService) {
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
        next: (response) =>  this.http.setJWTToken(response.token),
        error: (error) => console.error('Registration failed', error),
      });
    }
  }

  passwordIsTheSame() {
    const { email, password, confirmPassword } = this.registerForm.value;
    return password == confirmPassword;
  }
}
