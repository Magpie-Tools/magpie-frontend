import {HlmButton} from '@spartan-ng/helm/button';
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-import-dialog-content',
  standalone: true,
  imports: [HlmButton, FormsModule],
  templateUrl: './import-dialog-content.component.html',
  styleUrl: './import-dialog-content.component.scss',
})
export class ImportDialogContentComponent {
  @Input() inputTitle = '';
  @Input() inputDescription = '';
  @Input() textareaValue = '';
  @Input() textareaPlaceholder = '';
  @Input() textareaLabel = '';
  @Input() lineHint = '';
  @Input() clipboardPresent = false;
  @Input() filePresent = false;
  @Input() fileAccept = '';

  @Output() textareaValueChange = new EventEmitter<string>();
  @Output() pasteRequested = new EventEmitter<void>();
  @Output() clipboardClearRequested = new EventEmitter<void>();
  @Output() fileSelected = new EventEmitter<Event>();
  @Output() fileClearRequested = new EventEmitter<void>();
}
