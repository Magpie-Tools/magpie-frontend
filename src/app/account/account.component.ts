import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import {HttpService} from '../services/http.service';
import {ChangePassword} from '../models/ChangePassword';
import {SnackbarService} from '../services/snackbar.service';

@Component({
    selector: 'app-account',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
    ],
    templateUrl: './account.component.html',
    styleUrls: ['./account.component.scss']
})
export class AccountComponent {
  passwordForm: FormGroup;

  constructor(private fb: FormBuilder, private http: HttpService) {
    this.passwordForm = this.fb.group(
      {
        oldPassword: ['', [Validators.required]],
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        newPasswordCheck: ['', [Validators.required]],
      },
      { validators: this.passwordsMatchValidator }
    );
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
        next:  res  => SnackbarService.openSnackbar(res, 5000),
        error: err => SnackbarService.openSnackbar("There has been an error while changing the password! " + err.error.message, 5000)
      });

      // this.passwordForm.reset();
    } else {
      this.passwordForm.markAllAsTouched();
    }
  }
}
