import {afterEveryRender, AfterRenderRef, Directive, ElementRef, Input, OnDestroy} from '@angular/core';
import {gsap} from 'gsap';

@Directive({
  selector: '[appRevealGroup]',
  standalone: true,
})
export class RevealGroupDirective implements OnDestroy {
  @Input('appRevealGroup') targets = '';
  @Input() revealReady = true;

  private animationContext?: gsap.Context;
  private readonly renderRef: AfterRenderRef;
  private revealed = false;

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {
    // Inputs can become ready before Angular renders their conditional content.
    this.renderRef = afterEveryRender(() => this.reveal());
  }

  private reveal(): void {
    if (!this.revealReady || !this.targets || this.revealed) {
      return;
    }

    this.revealed = true;
    this.renderRef.destroy();
    if (
      typeof window === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    this.animationContext = gsap.context(() => {
      gsap.fromTo(
        this.targets,
        {opacity: 0, y: 20, scale: 0.99},
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.65,
          stagger: 0.055,
          ease: 'power3.out',
          clearProps: 'transform',
        },
      );
    }, this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.renderRef.destroy();
    this.animationContext?.revert();
  }
}
