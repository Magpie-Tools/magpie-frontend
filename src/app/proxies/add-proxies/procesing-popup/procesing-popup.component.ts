import {Component, EventEmitter, Input, Output} from '@angular/core';
import {StarBackgroundComponent} from '../../../ui-elements/star-background/star-background.component';
import {animate, style, transition, trigger} from '@angular/animations';
import {NgIf} from '@angular/common';

@Component({
  selector: 'app-procesing-popup',
  standalone: true,
  imports: [
    StarBackgroundComponent,
    NgIf
  ],
  templateUrl: './procesing-popup.component.html',
  styleUrl: './procesing-popup.component.scss',
  animations: [
    trigger('textAnimation', [
      transition(':increment, :decrement', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('500ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ]
})
export class ProcesingPopupComponent {
  @Input() status: 'processing' | 'success' | 'error' = 'processing';
  @Input() proxyCount: number = 0;
  @Output() closed = new EventEmitter<void>();

  messages = [
    'Please wait while we add your proxies.',
    'This can take a few seconds.',
    'Just a little longer, we’re on it.',
    'Hang tight, we’re working on it.',
    'Almost there... just a moment more.',
    'Seems like you added a lot of proxies, but don’t worry, we’ll handle it.',
    'Loading... good things take time!',
  ];
  currentMessageIndex = 0;
  textState = 0;

  get currentMessage(): string {
    if (this.status !== 'processing') return '';
    return this.messages[this.currentMessageIndex];
  }

  ngOnInit() {
    if (this.status === 'processing') {
      this.startMessageRotation();
    }
  }

  startMessageRotation() {
    const interval = setInterval(() => {
      if (this.status !== 'processing') {
        clearInterval(interval);
        return;
      }
      this.currentMessageIndex = (this.currentMessageIndex + 1) % this.messages.length;
      this.textState++;
    }, 10000);
  }

  onClose() {
    this.closed.emit();
  }
}
