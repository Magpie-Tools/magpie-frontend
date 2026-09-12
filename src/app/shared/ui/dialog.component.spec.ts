import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogComponent } from './dialog.component';

@Component({
  imports: [DialogComponent],
  template: `
    <button id="open-dialog" (click)="visible.set(true)">Open dialog</button>
    <app-dialog
      [(visible)]="visible"
      header="Edit settings"
      [closable]="closable()"
      (onHide)="closed = closed + 1"
    >
      <label for="dialog-name">Name</label><input id="dialog-name" />
      <button (click)="visible.set(false)">Done</button>
    </app-dialog>
  `,
})
class DialogHost {
  visible = signal(false);
  closable = signal(true);
  closed = 0;
}

describe('Spartan dialog integration', () => {
  it('opens an accessible dialog and synchronizes a user close with its owner', async () => {
    const fixture = TestBed.createComponent(DialogHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const trigger = fixture.nativeElement.querySelector(
      '#open-dialog',
    ) as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    await fixture.whenStable();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('Edit settings');
    expect(dialog.querySelector('#dialog-name')).toBeTruthy();
    (
      dialog.querySelector('[data-slot="dialog-close"]') as HTMLButtonElement
    ).click();
    await new Promise(resolve => setTimeout(resolve, 150));
    await fixture.whenStable();
    expect(fixture.componentInstance.visible()).toBeFalse();
    expect(fixture.componentInstance.closed).toBe(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it('removes dismissal controls while an action is pending', async () => {
    const fixture = TestBed.createComponent(DialogHost);
    fixture.componentInstance.closable.set(false);
    fixture.componentInstance.visible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('[data-slot="dialog-close"]')).toBeNull();
    fixture.componentInstance.visible.set(false);
    await fixture.whenStable();
    await new Promise(resolve => setTimeout(resolve, 150));
    await fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
