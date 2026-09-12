import { Injectable, signal } from '@angular/core';
export interface ConfirmationRequest {
  header: string;
  message: string;
  acceptLabel?: string;
  accept: () => void;
}
@Injectable()
export class ConfirmationService {
  readonly request = signal<ConfirmationRequest | null>(null);
  confirm(request: ConfirmationRequest): void {
    this.request.set(request);
  }
  cancel(): void {
    this.request.set(null);
  }
  accept(): void {
    const request = this.request();
    this.request.set(null);
    request?.accept();
  }
}
