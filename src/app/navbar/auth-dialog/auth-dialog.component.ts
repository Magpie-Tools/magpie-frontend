import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';

@Component({
  selector: 'app-auth-dialog',
  standalone: true,
  imports: [
    MatDialogModule, MatButtonModule
  ],
  templateUrl: './auth-dialog.component.html',
  styleUrl: './auth-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthDialogComponent {
  // readonly dialogRef = inject(MatDialogRef<AuthDialogComponent>);
  //
  // onNoClick(): void {
  //   this.dialogRef.close();
  // }
}
