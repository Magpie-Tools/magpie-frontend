import {Component, ElementRef, EventEmitter, inject, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, signal} from '@angular/core';

@Component({
    selector: 'app-procesing-popup',
    templateUrl: './procesing-popup.component.html',
    styleUrl: './procesing-popup.component.scss',
    // The host is the popover so it joins the top layer, and so open dialogs leave it out
    // when they mark the rest of the page aria-hidden.
    host: {popover: 'manual'},
})
export class ProcesingPopupComponent implements OnInit, OnChanges, OnDestroy {
  @Input() status: 'processing' | 'success' | 'error' = 'processing';
  @Input() count: number = 0;
  @Input() item: string = "";
  @Input() successNote = 'Queued for checking.';
  @Input() showDetailsButton = false;
  @Input() autoCloseOnSuccess = true;
  @Output() closed = new EventEmitter<void>();
  @Output() detailsRequested = new EventEmitter<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** A signal, so the rotating message re-renders without another change in the app. */
  readonly messageIndex = signal(0);
  private messageRotationIntervalId: ReturnType<typeof setInterval> | null = null;
  private autoCloseTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private showTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /** The item name in the singular when exactly one was added ("1 proxy", "1 scrape source"). */
  get itemLabel(): string {
    if (this.count !== 1) return this.item;
    if (this.item.endsWith('ies')) return this.item.slice(0, -3) + 'y';
    return this.item.endsWith('s') ? this.item.slice(0, -1) : this.item;
  }

  get messages(): string[] {
    return [
      `Validating ${this.item}.`,
      'Normalizing proxy formats.',
      'Removing duplicate entries.',
      'Preparing proxies for the checker.',
      'Finalizing the import.',
    ];
  }

  get currentMessage(): string {
    if (this.status !== 'processing') return '';
    return this.messages[this.messageIndex() % this.messages.length];
  }

  constructor() {
    // As a manual popover the popup sits in the browser's top layer above the import dialog
    // (also a CDK popover) that stays open while the upload runs; a dialog shown later, such
    // as the upload details, still stacks above it. The popup is created as the upload
    // starts, and in this zoneless app its view hooks only run on the next tick, which is
    // the server response. A timeout shows it as soon as Angular has inserted it.
    this.showTimeoutId = setTimeout(() => {
      this.showTimeoutId = null;
      this.showOverlay();
      if (this.status === 'processing' && this.messageRotationIntervalId === null) {
        this.startMessageRotation();
      }
    });
  }

  ngOnInit() {
    if (this.status === 'processing' && this.messageRotationIntervalId === null) {
      this.startMessageRotation();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item'] && !changes['item'].firstChange) {
      this.messageIndex.set(0);
    }

    if (changes['status']) {
      const currentStatus: 'processing' | 'success' | 'error' = changes['status'].currentValue;

      if (!changes['status'].firstChange) {
        if (currentStatus === 'processing') {
          this.clearAutoCloseTimeout();
          this.startMessageRotation();
        } else {
          this.clearMessageRotation();

          if (currentStatus === 'success' && this.autoCloseOnSuccess) {
            this.scheduleAutoClose();
          } else {
            this.clearAutoCloseTimeout();
          }
        }
      } else if (currentStatus === 'success' && this.autoCloseOnSuccess) {
        this.scheduleAutoClose();
      }
    }

    if (changes['autoCloseOnSuccess'] && this.status === 'success') {
      if (this.autoCloseOnSuccess) {
        this.scheduleAutoClose();
      } else {
        this.clearAutoCloseTimeout();
      }
    }
  }

  ngOnDestroy(): void {
    const host = this.host.nativeElement;
    if (host.parentElement === document.body) {
      host.remove();
    }
    if (this.showTimeoutId !== null) {
      clearTimeout(this.showTimeoutId);
    }
    this.clearMessageRotation();
    this.clearAutoCloseTimeout();
  }

  startMessageRotation() {
    this.clearMessageRotation();
    this.messageIndex.set(0);

    this.messageRotationIntervalId = setInterval(() => {
      if (this.status !== 'processing') {
        this.clearMessageRotation();
        return;
      }

      this.messageIndex.update(index => index + 1);
    }, 10000);
  }

  onClose() {
    this.clearAutoCloseTimeout();
    this.closed.emit();
  }

  onDetails() {
    this.detailsRequested.emit();
  }

  private showOverlay(): void {
    const host = this.host.nativeElement;
    if (!host.isConnected || typeof host.showPopover !== 'function') {
      return;
    }
    // Open dialogs hide the existing children of <body> from assistive technology, so the
    // host moves out of the page content first. Moving a shown popover would close it.
    if (host.parentElement !== document.body) {
      document.body.appendChild(host);
    }
    if (!host.matches(':popover-open')) {
      host.showPopover();
    }
    host.querySelector<HTMLElement>('.popup-panel')?.focus({preventScroll: true});
  }

  private clearMessageRotation(): void {
    if (this.messageRotationIntervalId !== null) {
      clearInterval(this.messageRotationIntervalId);
      this.messageRotationIntervalId = null;
    }
  }

  private scheduleAutoClose(delayMs: number = 2000): void {
    this.clearAutoCloseTimeout();
    this.autoCloseTimeoutId = setTimeout(() => this.onClose(), delayMs);
  }

  private clearAutoCloseTimeout(): void {
    if (this.autoCloseTimeoutId !== null) {
      clearTimeout(this.autoCloseTimeoutId);
      this.autoCloseTimeoutId = null;
    }
  }
}
