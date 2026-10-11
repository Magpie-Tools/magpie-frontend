import {Component, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {gsap} from 'gsap';
import {RevealGroupDirective} from './reveal-group.directive';

@Component({
  imports: [RevealGroupDirective],
  template: `
    <main appRevealGroup=".heading, .card" [revealReady]="ready()">
      <header class="heading">Page title</header>
      @if (loaded()) {
        <section class="card">Loaded content</section>
      }
    </main>
  `,
})
class RevealHostComponent {
  readonly ready = signal(false);
  readonly loaded = signal(false);
}

describe('RevealGroupDirective', () => {
  let fixture: ComponentFixture<RevealHostComponent>;
  let reducedMotion: boolean;

  beforeEach(async () => {
    reducedMotion = false;
    spyOn(window, 'matchMedia').and.callFake(() => ({matches: reducedMotion}) as MediaQueryList);
    await TestBed.configureTestingModule({imports: [RevealHostComponent]}).compileComponents();
    fixture = TestBed.createComponent(RevealHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function heading(): HTMLElement {
    return fixture.nativeElement.querySelector('.heading');
  }

  function card(): HTMLElement {
    return fixture.nativeElement.querySelector('.card');
  }

  async function settleLoad(): Promise<void> {
    fixture.componentInstance.loaded.set(true);
    fixture.componentInstance.ready.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('includes conditional cards rendered when the first load becomes ready', async () => {
    expect(card()).toBeNull();
    expect(gsap.getTweensOf(heading())).toEqual([]);

    await settleLoad();
    const entrance = gsap.getTweensOf(card());
    expect(entrance.length).toBe(1);
    expect(gsap.getTweensOf(heading())).toEqual(entrance);
    expect(entrance[0].targets()).toEqual([heading(), card()]);
  });

  it('does not restart an entrance during subsequent refreshes', async () => {
    await settleLoad();
    const entrance = gsap.getTweensOf(card())[0];
    entrance.pause().progress(0.5);

    fixture.componentInstance.ready.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    await settleLoad();

    expect(gsap.getTweensOf(card())).toEqual([entrance]);
    expect(entrance.progress()).toBe(0.5);
  });

  it('leaves transforms clear after the entrance finishes', async () => {
    await settleLoad();
    gsap.getTweensOf(card())[0].progress(1);

    expect(card().style.transform).toBe('');
    expect(heading().style.transform).toBe('');
    expect(card().style.opacity).toBe('1');
  });

  it('scopes the entrance to the current page', async () => {
    const otherPage = document.createElement('section');
    otherPage.className = 'card';
    document.body.append(otherPage);
    try {
      await settleLoad();
      expect(gsap.getTweensOf(otherPage)).toEqual([]);
      expect(otherPage.style.opacity).toBe('');
    } finally {
      otherPage.remove();
    }
  });

  it('shows loaded content without animation for reduced motion', async () => {
    reducedMotion = true;
    await settleLoad();

    expect(card().textContent).toContain('Loaded content');
    expect(gsap.getTweensOf(card())).toEqual([]);
    expect(card().style.opacity).toBe('');
    expect(heading().style.transform).toBe('');
  });

  it('reverts the animation when navigating away', async () => {
    await settleLoad();
    const target = card();
    const title = heading();
    fixture.destroy();

    expect(gsap.getTweensOf(target)).toEqual([]);
    expect(target.style.transform).toBe('');
    expect(title.style.opacity).toBe('');
  });
});
