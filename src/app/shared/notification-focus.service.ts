import {afterNextRender, AfterRenderRef, DestroyRef, ElementRef, inject, Injectable, Injector, signal} from '@angular/core';

interface NotificationFocusRequest {
  id: number;
  selector: string;
  isCurrent: () => boolean;
  onFocused: () => void;
  onMissing?: () => void;
}

export function parseNotificationTargetId(value: string | null): number | null {
  const id = value && /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(id) ? id : null;
}

/** Provide on a page component. Bind highlightedId to a class using the notification-highlight Sass mixin. */
@Injectable()
export class NotificationFocusService {
  private readonly activeId = signal<number | null>(null);
  readonly highlightedId = this.activeId.asReadonly();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private render?: AfterRenderRef;
  private highlightTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  schedule(request: NotificationFocusRequest): void {
    this.clear();
    this.render = afterNextRender(() => {
      if (!request.isCurrent()) return;
      const target = this.host.nativeElement.querySelector<HTMLElement>(request.selector);
      if (!target) {
        request.onMissing?.();
        return;
      }
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest'});
      target.focus({preventScroll: true});
      this.activeId.set(request.id);
      this.highlightTimer = setTimeout(() => this.clear(), 3000);
      request.onFocused();
    }, {injector: this.injector});
  }

  cancelPending(): void {
    this.render?.destroy();
    this.render = undefined;
  }

  clear(): void {
    this.cancelPending();
    clearTimeout(this.highlightTimer);
    this.highlightTimer = undefined;
    this.activeId.set(null);
  }
}
