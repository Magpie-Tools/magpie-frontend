import {gsap} from 'gsap';

export function animateDialogSections(dialogClass: string): void {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  requestAnimationFrame(() => {
    const dialog = document.querySelector(`.${dialogClass}`);
    if (!dialog) {
      return;
    }

    const sections = dialog.querySelectorAll<HTMLElement>(
      '.proxy-dialog-heading > *, .proxy-dialog-body > *, .proxy-dialog-footer > *, .tag-manager > *'
    );

    gsap.fromTo(
      sections,
      {opacity: 0, y: 12},
      {
        opacity: 1,
        y: 0,
        duration: 0.42,
        stagger: 0.035,
        ease: 'power3.out',
        clearProps: 'opacity,transform',
      },
    );
  });
}
