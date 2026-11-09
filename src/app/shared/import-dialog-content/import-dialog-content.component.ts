import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';

// The body of the add proxies and add sources dialogs: an input section with the
// textarea and live counts, then an options section. It follows the alert destination
// form, with flat sections split by a rule instead of boxed cards.
@Component({
  selector: 'app-import-dialog-content',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './import-dialog-content.component.html',
  styleUrl: './import-dialog-content.component.scss',
})
export class ImportDialogContentComponent {
  @Input() inputTitle = '';
  @Input() inputHint = '';
  @Input() optionsTitle = '';
  @Input() optionsOptional = false;
  @Input() textareaValue = '';
  @Input() textareaPlaceholder = '';
  @Input() textareaLabel = '';
  @Input() clipboardPresent = false;
  @Input() filePresent = false;
  @Input() fileAccept = '';

  @Output() textareaValueChange = new EventEmitter<string>();
  @Output() pasteRequested = new EventEmitter<void>();
  @Output() clipboardClearRequested = new EventEmitter<void>();
  @Output() fileSelected = new EventEmitter<Event>();
  @Output() fileClearRequested = new EventEmitter<void>();
}
