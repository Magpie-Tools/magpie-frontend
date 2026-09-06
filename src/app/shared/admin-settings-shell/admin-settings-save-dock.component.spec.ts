import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {AdminSettingsSaveDockComponent} from './admin-settings-save-dock.component';

@Component({
  imports: [AdminSettingsSaveDockComponent],
  template: `
    <form (submit)="$event.preventDefault(); saves = saves + 1">
      <app-admin-settings-save-dock
        [dirty]="dirty" [invalid]="invalid" [readOnly]="readOnly"
        dirtyDescription="Save your changes." pristineTitle="Up to date"
        readOnlyDescription="You can inspect these settings."
      >
        <button settings-save-action type="button" (click)="actions = actions + 1">Requeue</button>
      </app-admin-settings-save-dock>
    </form>
  `,
})
class SaveDockHost {
  dirty = false;
  invalid = false;
  readOnly = false;
  saves = 0;
  actions = 0;
}

describe('AdminSettingsSaveDockComponent', () => {
  it('submits the surrounding form only when editable, dirty, and valid', async () => {
    await TestBed.configureTestingModule({imports: [SaveDockHost]}).compileComponents();
    const fixture = TestBed.createComponent(SaveDockHost);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBeTrue();
    host.dirty = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    button.click();
    expect(host.saves).toBe(1);

    for (const state of ['invalid', 'readOnly'] as const) {
      host[state] = true;
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      expect(button.disabled).toBeTrue();
      button.click();
      expect(host.saves).toBe(1);
      host[state] = false;
    }
    host.readOnly = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Viewer access');
    const action = fixture.nativeElement.querySelector('[settings-save-action]') as HTMLButtonElement;
    action.click();
    expect(host.actions).toBe(1);
    expect(host.saves).toBe(1);
  });
});
