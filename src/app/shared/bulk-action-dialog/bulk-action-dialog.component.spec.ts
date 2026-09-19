import { TestBed } from '@angular/core/testing';
import { BulkActionDialogComponent } from './bulk-action-dialog.component';

describe('Bulk action dialog focus', () => {
  for (const tone of ['default', 'danger'] as const) {
    it(`keeps header help closed on opening a ${tone} dialog and available on focus`, async () => {
      const fixture = TestBed.createComponent(BulkActionDialogComponent);
      fixture.componentRef.setInput('tone', tone);
      fixture.componentRef.setInput('headingTitle', 'Manage proxies');
      fixture.componentRef.setInput('headingTooltip', 'Help with this action');
      fixture.detectChanges();
      await fixture.whenStable();

      for (let opening = 0; opening < 2; opening++) {
        fixture.componentRef.setInput('visible', true);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 250));
        await fixture.whenStable();

        const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
        expect(document.activeElement).toBe(dialog.querySelector('h2'));
        expect(document.querySelector('[role="tooltip"]')).toBeNull();

        const info = dialog.querySelector<HTMLButtonElement>('app-tooltip button')!;
        expect(info.tabIndex).toBe(0);
        info.focus();
        await new Promise(resolve => setTimeout(resolve, 250));
        await fixture.whenStable();
        expect(document.querySelector('[role="tooltip"]')?.textContent).toContain('Help with this action');

        fixture.componentRef.setInput('visible', false);
        fixture.detectChanges();
        await new Promise(resolve => setTimeout(resolve, 250));
        await fixture.whenStable();
      }
    });
  }
});
