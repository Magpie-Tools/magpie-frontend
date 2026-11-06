import { TestBed } from '@angular/core/testing';
import { BulkActionDialogComponent } from './bulk-action-dialog.component';

describe('Bulk action dialog focus', () => {
  for (const tone of ['default', 'danger'] as const) {
    it(`scrolls long ${tone} dialog content while keeping actions visible`, async () => {
      const fixture = TestBed.createComponent(BulkActionDialogComponent);
      fixture.componentRef.setInput('tone', tone);
      fixture.componentRef.setInput('headingTitle', 'Manage proxies');
      fixture.componentRef.setInput('actionLabel', 'Apply');
      fixture.componentRef.setInput('visible', true);
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise(resolve => setTimeout(resolve, 250));

      const panel = document.querySelector<HTMLElement>('.app-dialog-panel')!;
      const body = panel.querySelector<HTMLElement>('.app-dialog-body')!;
      const footer = panel.querySelector<HTMLElement>('.app-dialog-footer')!;
      const content = document.createElement('div');
      content.style.height = '200vh';
      body.appendChild(content);

      // Exercise both a full-height window and a short mobile/landscape dialog.
      for (const maxHeight of ['calc(100dvh - 2rem)', '320px']) {
        panel.style.maxHeight = maxHeight;
        body.scrollTop = 0;
        const footerTop = footer.getBoundingClientRect().top;
        expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
        expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
        expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(panel.getBoundingClientRect().bottom);
        body.scrollTop = body.scrollHeight;
        expect(body.scrollTop).toBeGreaterThan(0);
        expect(footer.getBoundingClientRect().top).toBe(footerTop);
      }

      fixture.componentRef.setInput('visible', false);
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 150));
      await fixture.whenStable();
    });

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
