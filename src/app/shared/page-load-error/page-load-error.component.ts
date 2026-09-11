import {Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
  selector: 'app-page-load-error',
  standalone: true,
  templateUrl: './page-load-error.component.html',
  styleUrl: './page-load-error.component.scss',
})
export class PageLoadErrorComponent {
  @Input() title = '';
  @Input() message = '';
  @Output() retry = new EventEmitter<void>();
}
