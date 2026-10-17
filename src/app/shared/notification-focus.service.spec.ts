import {Component, inject, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NotificationFocusService} from './notification-focus.service';

@Component({
  providers: [NotificationFocusService],
  template: `@if (visible()) { <article id="notification-target" tabindex="-1">Notification target</article> }`,
})
class NotificationFocusHost {
  readonly focus = inject(NotificationFocusService);
  readonly visible = signal(false);
}

describe('NotificationFocusService', () => {
  let fixture: ComponentFixture<NotificationFocusHost>;

  beforeEach(async () => {
    spyOn(window, 'matchMedia').and.returnValue({matches: true} as MediaQueryList);
    await TestBed.configureTestingModule({imports: [NotificationFocusHost]}).compileComponents();
    fixture = TestBed.createComponent(NotificationFocusHost);
    fixture.detectChanges();
  });

  it('waits for rendering and ignores a request that became stale', async () => {
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    const onFocused = jasmine.createSpy('onFocused');
    let current = true;
    fixture.componentInstance.visible.set(true);
    fixture.componentInstance.focus.schedule({id: 4, selector: '#notification-target', isCurrent: () => current, onFocused});
    current = false;
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scroll).not.toHaveBeenCalled();
    expect(onFocused).not.toHaveBeenCalled();

    current = true;
    fixture.componentInstance.focus.schedule({id: 4, selector: '#notification-target', isCurrent: () => current, onFocused});
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scroll.calls.mostRecent().object).toBe(fixture.nativeElement.querySelector('#notification-target'));
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#notification-target'));
    expect(fixture.componentInstance.focus.highlightedId()).toBe(4);
    expect(onFocused).toHaveBeenCalledTimes(1);
  });

  it('reports missing targets without focusing an element outside its page', async () => {
    const outside = document.createElement('article');
    outside.id = 'notification-target';
    outside.tabIndex = -1;
    document.body.append(outside);
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    const onMissing = jasmine.createSpy('onMissing');
    const onFocused = jasmine.createSpy('onFocused');
    try {
      fixture.componentInstance.focus.schedule({id: 4, selector: '#notification-target', isCurrent: () => true, onFocused, onMissing});
      fixture.detectChanges();
      await fixture.whenStable();
      expect(onMissing).toHaveBeenCalledTimes(1);
      expect(onFocused).not.toHaveBeenCalled();
      expect(scroll).not.toHaveBeenCalled();
      expect(fixture.componentInstance.focus.highlightedId()).toBeNull();
    } finally {
      outside.remove();
    }
  });

  it('cancels scheduled work and clears an active highlight when the page is destroyed', async () => {
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    const request = {id: 4, selector: '#notification-target', isCurrent: () => true, onFocused: () => undefined};
    const focus = fixture.componentInstance.focus;
    fixture.componentInstance.visible.set(true);
    focus.schedule(request);
    focus.clear();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scroll).not.toHaveBeenCalled();

    focus.schedule(request);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(focus.highlightedId()).toBe(4);
    fixture.destroy();
    expect(focus.highlightedId()).toBeNull();
  });
});
