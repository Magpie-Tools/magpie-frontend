import {Component, EventEmitter, Input, Output} from '@angular/core';
import {ButtonModule} from 'primeng/button';
import {DialogModule} from 'primeng/dialog';
import {TooltipComponent} from '../../tooltip/tooltip.component';
import {animateDialogSections} from '../dialog-motion';

export type BulkDialogTone = 'default' | 'danger';

@Component({
  selector: 'app-bulk-action-dialog',
  standalone: true,
  imports: [ButtonModule, DialogModule, TooltipComponent],
  templateUrl: './bulk-action-dialog.component.html',
  styleUrl: './bulk-action-dialog.component.scss',
})
export class BulkActionDialogComponent {
  @Input() visible = false;
  @Input() dialogClass = 'bulk-action-dialog-instance';
  @Input() width = '58rem';
  @Input() triggerLabel = '';
  @Input() triggerIcon = '';
  @Input() triggerStyleClass = '';
  @Input() triggerDisabled = false;
  @Input() headingEyebrow = '';
  @Input() headingTitle = '';
  @Input() headingIcon = '';
  @Input() headingTooltip = '';
  @Input() tone: BulkDialogTone = 'default';
  @Input() introIcon = '';
  @Input() introTitle = '';
  @Input() introDescription = '';
  @Input() selectedCount = 0;
  @Input() footerNote = '';
  @Input() cancelDisabled = false;
  @Input() actionLabel = '';
  @Input() actionIcon = '';
  @Input() actionIconPos: 'left' | 'right' | 'top' | 'bottom' = 'left';
  @Input() actionDisabled = false;
  @Input() actionLoading = false;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() openRequested = new EventEmitter<void>();
  @Output() cancelRequested = new EventEmitter<void>();
  @Output() actionRequested = new EventEmitter<void>();
  @Output() hidden = new EventEmitter<void>();

  get styleClass(): string {
    return `bulk-action-dialog bulk-action-dialog--${this.tone} ${this.dialogClass}`;
  }

  onShow(): void {
    animateDialogSections(this.dialogClass);
  }
}
