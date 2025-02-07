import { Injectable, Injector } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class SnackbarService {
  private static injector: Injector;

  constructor(injector: Injector) {
    SnackbarService.injector = injector;
  }

  private static get snackBar(): MatSnackBar {
    return SnackbarService.injector.get(MatSnackBar);
  }

  public static openSnackbar(text: string, duration: number): void {
    this.snackBar.open(text, '', { duration });
  }

  public static openSnackbarAction(text: string, action: string, duration: number): void {
    this.snackBar.open(text, action, { duration });
  }
}
