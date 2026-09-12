import {HlmButton} from '@spartan-ng/helm/button';
import {Component, Input, ViewEncapsulation} from '@angular/core';

@Component({
  selector: 'app-admin-settings-save-dock',
  standalone: true,
  imports: [HlmButton],
  styleUrl: './admin-settings-save-dock.component.scss',
  encapsulation: ViewEncapsulation.None,
  template: `
    <footer class="save-dock">
      <div class="save-state" aria-live="polite">
        <span class="save-state__dot" [class.is-dirty]="dirty" aria-hidden="true"></span>
        <div>
          @if (readOnly) {
            <strong>{{ readOnlyTitle }}</strong><p>{{ readOnlyDescription }}</p>
          } @else if (dirty) {
            <strong>{{ dirtyTitle }}</strong><p>{{ dirtyDescription }}</p>
          } @else {
            <strong>{{ pristineTitle }}</strong><p>{{ pristineDescription }}</p>
          }
        </div>
      </div>
      <div class="save-actions">
        <ng-content select="[settings-save-action]"></ng-content>
        <button type="submit" [disabled]="readOnly || !dirty || invalid" class="save-button" hlmBtn variant="default"><i class="icon icon-check" aria-hidden="true"></i>{{ saveLabel }}</button>
      </div>
    </footer>
  `,
})
export class AdminSettingsSaveDockComponent {
  @Input() readOnly = false;
  @Input() readOnlyTitle = 'Viewer access';
  @Input() readOnlyDescription = '';
  @Input() dirty = false;
  @Input() invalid = false;
  @Input() dirtyTitle = 'Unsaved global changes';
  @Input({required: true}) dirtyDescription = '';
  @Input({required: true}) pristineTitle = '';
  @Input() pristineDescription = 'Changes will appear here before you save.';
  @Input() saveLabel = 'Save global settings';
}
