import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatDivider} from '@angular/material/divider';
import {MatIcon} from '@angular/material/icon';
import {DialogPosition, MatDialog} from '@angular/material/dialog';
import {AuthDialogComponent} from './auth-dialog/auth-dialog.component';
import {MatButton} from '@angular/material/button';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    MatDivider,
    MatIcon,
    MatButton,
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavbarComponent {
  readonly dialog = inject(MatDialog);

  public showAuthPopup() {
    const dialogRef = this.dialog.open(AuthDialogComponent, {
      hasBackdrop: true,
      disableClose: true, // Prevent closing by clicking outside
      panelClass: 'centered-dialog',
      backdropClass: 'cdk-overlay-backdrop'
    });


    dialogRef.afterClosed().subscribe(result => {
      console.log(`Dialog result: ${result}`);
    });
  }
}
