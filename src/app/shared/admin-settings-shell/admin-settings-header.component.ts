import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-admin-settings-header',
  standalone: true,
  template: `
    <header class="admin-context">
      <div class="admin-context__copy">
        <span class="context-icon"><i [class]="icon" aria-hidden="true"></i></span>
        <div>
          <span class="context-eyebrow">{{ eyebrow }}</span>
          <h1>{{ title }}</h1>
          <p>{{ description }}</p>
        </div>
      </div>
      <div class="scope-badge"><span aria-hidden="true"></span>{{ badge }}</div>
    </header>
  `,
})
export class AdminSettingsHeaderComponent {
  @Input({required: true}) icon = '';
  @Input({required: true}) title = '';
  @Input({required: true}) description = '';
  @Input() eyebrow = '';
  @Input() badge = 'System defaults';
}
