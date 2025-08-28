import { Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class SnackbarService {
  private static messageService: MessageService;

  constructor(private messageServiceConst: MessageService) {
    SnackbarService.messageService = messageServiceConst;
  }

  static openSnackbar(text: string, duration: number): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Info',
      detail: text,
      life: duration
    });
  }

  static openSnackbarDefault(text: string): void {
    this.openSnackbar(text, 5000);
  }

  static openSnackbarAction(text: string, action: string, duration: number): void {
    this.messageService.add({
      severity: 'warn',
      summary: action,
      detail: text,
      life: duration
    });
  }
}
