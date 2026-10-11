import {ComponentFixture, TestBed} from '@angular/core/testing';
import {CountryHoverCardComponent} from './country-hover-card.component';

describe('CountryHoverCardComponent', () => {
  let fixture: ComponentFixture<CountryHoverCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [CountryHoverCardComponent]}).compileComponents();
    fixture = TestBed.createComponent(CountryHoverCardComponent);
    fixture.componentRef.setInput('country', 'Germany');
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  const settleHover = async () => {
    await new Promise(resolve => setTimeout(resolve, 250));
    fixture.detectChanges();
  };

  it('opens the marked map on hover and keeps it open while the pointer enters the card', async () => {
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(document.querySelector('.country-hover-card')).toBeNull();
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await settleHover();
    const card = document.querySelector('.country-hover-card') as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.id).toBe(trigger.getAttribute('aria-describedby')!);
    expect(card.querySelector('svg')?.getAttribute('aria-label')).toBe('World map centered on Germany');
    expect(card.querySelector('.country-hover-card__selected')?.getAttribute('d')).toBeTruthy();
    expect(card.querySelector('.country-hover-card__marker')).not.toBeNull();
    trigger.dispatchEvent(new MouseEvent('mouseleave'));
    card.closest('.cdk-overlay-connected-position-bounding-box')!.dispatchEvent(new MouseEvent('mouseenter'));
    await settleHover();
    expect(document.querySelector('.country-hover-card')).toBe(card);
    card.closest('.cdk-overlay-connected-position-bounding-box')!.dispatchEvent(new MouseEvent('mouseleave'));
    await settleHover();
    expect(document.querySelector('.country-hover-card')).toBeNull();
  });

  it('opens on keyboard focus and dismisses with Escape without moving focus', async () => {
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    await settleHover();
    expect(document.querySelector('.country-hover-card')).not.toBeNull();
    trigger.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    fixture.detectChanges();
    expect(document.querySelector('.country-hover-card')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    trigger.blur();
  });

  it('dismisses a map opened by hovering when Escape is pressed elsewhere', async () => {
    fixture.nativeElement.querySelector('button').dispatchEvent(new MouseEvent('mouseenter'));
    await settleHover();
    expect(document.querySelector('.country-hover-card')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    fixture.detectChanges();
    expect(document.querySelector('.country-hover-card')).toBeNull();
  });

  it('removes an open overlay when leaving the proxy details', async () => {
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    await settleHover();
    expect(document.querySelector('.country-hover-card')).not.toBeNull();
    fixture.destroy();
    expect(document.querySelector('.country-hover-card')).toBeNull();
  });

  it('removes an open map if the next proxy has no known country', async () => {
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    await settleHover();
    expect(document.querySelector('.country-hover-card')).not.toBeNull();
    fixture.componentRef.setInput('country', 'Unknown');
    fixture.detectChanges();
    expect(document.querySelector('.country-hover-card')).toBeNull();
  });

  it('shows unknown or unsupported countries as plain text', () => {
    for (const country of ['Unknown', 'N/A', 'Atlantis', '']) {
      fixture.componentRef.setInput('country', country);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent.trim()).toBe(country || 'Unknown');
      expect(fixture.nativeElement.querySelector('button')).toBeNull();
    }
  });
});
