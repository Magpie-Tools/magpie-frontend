import {Injectable} from '@angular/core';
import {toast} from '@spartan-ng/brain/sonner';

@Injectable({providedIn: 'root'})
export class NotificationService {
  showError(detail: string, summary = 'Error'): void { toast.error(summary, {description: detail, duration: 6000}); }
  showSuccess(detail: string, summary = 'Success'): void { toast.success(summary, {description: detail, duration: 4000}); }
  showInfo(detail: string, summary = 'Info'): void { toast.info(summary, {description: detail, duration: 4000}); }
  showWarn(detail: string, summary = 'Warning'): void { toast.warning(summary, {description: detail, duration: 5000}); }
}
