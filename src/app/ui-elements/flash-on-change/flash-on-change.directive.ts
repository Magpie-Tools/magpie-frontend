import { Directive, Input, SimpleChanges, OnChanges, Renderer2, ElementRef } from '@angular/core';

@Directive({
  standalone: true,
  selector: '[flashOnChange]'
})
export class FlashOnChangeDirective implements OnChanges {
  @Input() flashOnChange: any;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['flashOnChange'] && !changes['flashOnChange'].isFirstChange()) {
      this.renderer.addClass(this.el.nativeElement, 'flash');
      setTimeout(() => {
        this.renderer.removeClass(this.el.nativeElement, 'flash');
      }, 600);
    }
  }
}
