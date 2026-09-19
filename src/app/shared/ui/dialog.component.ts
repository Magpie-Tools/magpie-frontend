import {
  Component,
  ContentChild,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
} from '@angular/core';
import { NgStyle, NgTemplateOutlet } from '@angular/common';
import { AutoFocusTarget } from '@angular/cdk/dialog';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';

@Component({
  selector: 'app-dialog',
  imports: [HlmDialogImports, NgTemplateOutlet, NgStyle],
  template: `
    <hlm-dialog
      [state]="visible ? 'open' : 'closed'"
      [closeOnOutsidePointerEvents]="dismissableMask && closable"
      [disableClose]="!closable"
      [autoFocus]="autoFocus"
      (stateChanged)="stateChanged($event)"
      (closed)="onHide.emit()"
    >
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="closable"
        [class]="'app-dialog-panel ' + styleClass"
        [ngStyle]="panelStyle"
      >
        <header hlmDialogHeader class="app-dialog-header">
          <h2 hlmDialogTitle>
            @if (dialogHeader) {
              <ng-container [ngTemplateOutlet]="dialogHeader" />
            } @else {
              {{ header }}
            }
          </h2>
        </header>
        <div class="app-dialog-body"><ng-content /></div>
        @if (dialogFooter) {
          <footer hlmDialogFooter class="app-dialog-footer">
            <ng-container [ngTemplateOutlet]="dialogFooter" />
          </footer>
        }
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class DialogComponent {
  @Input() visible = false;
  @Input() header = '';
  @Input() autoFocus: AutoFocusTarget | string | boolean = 'first-tabbable';
  @Input() closable = true;
  @Input() dismissableMask = false;
  @Input() styleClass = '';
  @Input() panelStyle: Record<string, any> = {};
  @ContentChild('dialogHeader') dialogHeader?: TemplateRef<unknown>;
  @ContentChild('dialogFooter') dialogFooter?: TemplateRef<unknown>;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() onShow = new EventEmitter<void>();
  @Output() onHide = new EventEmitter<void>();
  private hasOpened = false;

  stateChanged(state: 'open' | 'closed'): void {
    if (state === 'open') {
      this.hasOpened = true;
      this.onShow.emit();
    } else if (this.hasOpened) {
      this.hasOpened = false;
      this.visibleChange.emit(false);
    }
  }
}
