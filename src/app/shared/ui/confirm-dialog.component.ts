import { Component, inject } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { DialogComponent } from './dialog.component';
import { ConfirmationService } from './confirmation.service';
@Component({
  selector: 'app-confirm-dialog',
  imports: [DialogComponent, HlmButton],
  template: `
    <app-dialog
      [visible]="!!confirmation.request()"
      [header]="confirmation.request()?.header ?? 'Confirm action'"
      (visibleChange)="!$event && confirmation.cancel()"
    >
      <p>{{ confirmation.request()?.message }}</p>
      <div class="mt-6 flex justify-end gap-2">
        <button
          hlmBtn
          type="button"
          variant="outline"
          (click)="confirmation.cancel()"
        >
          Cancel
        </button>
        <button
          hlmBtn
          type="button"
          variant="destructive"
          (click)="confirmation.accept()"
        >
          {{ confirmation.request()?.acceptLabel ?? 'Confirm' }}
        </button>
      </div>
    </app-dialog>
  `,
})
export class ConfirmDialogComponent {
  readonly confirmation = inject(ConfirmationService);
}
