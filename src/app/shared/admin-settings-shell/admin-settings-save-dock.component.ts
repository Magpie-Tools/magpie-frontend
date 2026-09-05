import {Component, Input} from '@angular/core';
import {ButtonModule} from 'primeng/button';

@Component({
  selector: 'app-admin-settings-save-dock',
  standalone: true,
  imports: [ButtonModule],
  template: `
    <footer class="save-dock">
      <div class="save-state" aria-live="polite">
        <span class="save-state__dot" [class.is-dirty]="dirty" aria-hidden="true"></span>
        <div>
          @if (dirty) {
            <strong>{{ dirtyTitle }}</strong><p>{{ dirtyDescription }}</p>
          } @else {
            <strong>{{ pristineTitle }}</strong><p>{{ pristineDescription }}</p>
          }
        </div>
      </div>
      <div class="save-actions">
        <ng-content select="[settings-save-action]"></ng-content>
        <p-button
          type="submit"
          [label]="saveLabel"
          icon="pi pi-check"
          [disabled]="!dirty || invalid"
          styleClass="save-button"
        ></p-button>
      </div>
    </footer>
  `,
})
export class AdminSettingsSaveDockComponent {
  @Input() dirty = false;
  @Input() invalid = false;
  @Input() dirtyTitle = 'Unsaved global changes';
  @Input({required: true}) dirtyDescription = '';
  @Input({required: true}) pristineTitle = '';
  @Input() pristineDescription = 'Changes will appear here before you save.';
  @Input() saveLabel = 'Save global settings';
}
