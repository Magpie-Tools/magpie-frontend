import {ComponentFixture, TestBed} from '@angular/core/testing';
import {DetailStatusBannerComponent} from './detail-status-banner.component';

describe('DetailStatusBannerComponent', () => {
  let fixture: ComponentFixture<DetailStatusBannerComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(DetailStatusBannerComponent);
    host = fixture.nativeElement;
    fixture.componentRef.setInput('label', 'Alive');
  });

  it('shows the result with its relative and exact time', () => {
    const at = new Date(Date.now() - 4.5 * 60_000).toISOString();
    fixture.componentRef.setInput('tone', 'good');
    fixture.componentRef.setInput('timestamp', at);
    fixture.componentRef.setInput('timestampPrefix', 'Last checked');
    fixture.detectChanges();

    expect(host.dataset['tone']).toBe('good');
    expect(host.querySelector('.status-banner__icon')?.classList).toContain('icon-circle-check');
    expect(host.querySelector('.status-banner__label')?.textContent).toBe('Alive');
    expect(host.querySelector('.status-banner__meta')?.textContent).toContain('Last checked 4 min ago · ');
    expect(host.querySelector('time')?.getAttribute('datetime')).toBe(at);
  });

  it('shows the empty text without a timestamp', () => {
    fixture.componentRef.setInput('label', 'Not checked');
    fixture.componentRef.setInput('emptyText', 'No check results yet');
    fixture.detectChanges();

    expect(host.dataset['tone']).toBe('neutral');
    expect(host.querySelector('.status-banner__meta')?.textContent?.trim()).toBe('No check results yet');
    expect(host.querySelector('time')).toBeNull();
  });
});
