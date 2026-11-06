import {HlmButton} from '@spartan-ng/helm/button';
import {DialogComponent} from '../ui/dialog.component';
import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';

import {TooltipComponent} from '../../tooltip/tooltip.component';
import {animateDialogSections} from '../dialog-motion';

export type BulkDialogTone = 'default' | 'danger';

@Component({
  selector: 'app-bulk-action-dialog',
  standalone: true,
  imports: [HlmButton, DialogComponent, TooltipComponent],
  templateUrl: './bulk-action-dialog.component.html',
  styleUrl: './bulk-action-dialog.component.scss',
})
export class BulkActionDialogComponent implements OnChanges {
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
  /** When set, the action stays disabled until the user ticks this acknowledgement. */
  @Input() confirmLabel = '';
  confirmed = false;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() openRequested = new EventEmitter<void>();
  @Output() cancelRequested = new EventEmitter<void>();
  @Output() actionRequested = new EventEmitter<void>();
  @Output() hidden = new EventEmitter<void>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['confirmLabel'] || (changes['visible'] && !this.visible)) {
      this.confirmed = false;
    }
  }

  get actionBlocked(): boolean {
    return this.actionDisabled || this.actionLoading || (!!this.confirmLabel && !this.confirmed);
  }

  get styleClass(): string {
    return `bulk-action-dialog bulk-action-dialog--${this.tone} ${this.dialogClass}`;
  }

  onShow(): void {
    animateDialogSections(this.dialogClass);
  }
}
