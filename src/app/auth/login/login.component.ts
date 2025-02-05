import { Component } from '@angular/core';
import {MatFormField, MatLabel} from "@angular/material/form-field";
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import {MatButton} from "@angular/material/button";
import {RouterLink} from "@angular/router";
import {MatCard} from "@angular/material/card";
import {MatInput} from "@angular/material/input";
import {User} from '../../models/userModel';
import {HttpService} from '../../services/http.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    MatLabel,
    MatFormField,
    ReactiveFormsModule,
    MatButton,
    RouterLink,
    MatCard,
    MatInput
  ],
  templateUrl: './login.component.html',
  styleUrl: '../auth.component.scss'
})
export class LoginComponent {
  loginForm: FormGroup;

  constructor(private fb: FormBuilder, private http: HttpService) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  onLogin() {
    const { email, password } = this.loginForm.value;
    const user: User = { email, password };
    this.http.loginUser(user).subscribe({
      next: (response) =>  this.http.setJWTToken(response.token),
    })
  }
}
