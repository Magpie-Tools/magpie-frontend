import {AfterViewInit, Directive, ElementRef, Input, OnDestroy} from '@angular/core';
import {gsap} from 'gsap';

export interface RevealStep {
  selector: string;
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
}

export type RevealGroupConfig = string | readonly RevealStep[];

@Directive({
  selector: '[appRevealGroup]',
  standalone: true,
})
export class RevealGroupDirective implements AfterViewInit, OnDestroy {
  @Input('appRevealGroup') config: RevealGroupConfig = '';

  private animationContext?: gsap.Context;

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    if (
      !this.config ||
      typeof window === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const steps = typeof this.config === 'string'
      ? [{selector: this.config}]
      : this.config;

    this.animationContext = gsap.context(() => {
      for (const step of steps) {
        gsap.fromTo(
          step.selector,
          {opacity: 0, y: 22, scale: 0.99, ...step.from},
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.68,
            stagger: 0.06,
            ease: 'power3.out',
            clearProps: 'transform',
            ...step.to,
          },
        );
      }
    }, this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.animationContext?.revert();
  }
}
