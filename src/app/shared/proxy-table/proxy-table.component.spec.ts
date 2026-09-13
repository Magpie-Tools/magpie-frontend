import {ComponentFixture, TestBed} from '@angular/core/testing';
import {OverlayContainer} from '@angular/cdk/overlay';
import {ProxyTableComponent} from './proxy-table.component';
import {ProxyInfo} from '../../models/ProxyInfo';
import {ClipboardService} from '../../services/clipboard.service';

describe('Proxy table actions menu', () => {
  let fixture: ComponentFixture<ProxyTableComponent>;
  let overlay: HTMLElement;
  const proxy = {
    id: 1, ip: '192.0.2.1', port: 8080, alive: true,
    estimated_type: '', response_time: 10, country: '', anonymity_level: '',
    latest_check: new Date(), state: 'active',
  } satisfies ProxyInfo;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProxyTableComponent],
      providers: [{provide: ClipboardService, useValue: {copyText: jasmine.createSpy().and.resolveTo(true)}}],
    }).compileComponents();
    fixture = TestBed.createComponent(ProxyTableComponent);
    fixture.componentRef.setInput('columns', ['actions']);
    fixture.componentRef.setInput('proxies', [{...proxy}]);
    fixture.componentRef.setInput('lifecycleEnabled', true);
    fixture.componentRef.setInput('checkEnabled', true);
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(() => fixture.destroy());

  async function openMenu() {
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.proxy-actions-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function item(label: string): HTMLButtonElement {
    const button = Array.from(overlay.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
      .find(button => button.textContent?.trim() === label);
    expect(button).withContext(label).toBeDefined();
    return button!;
  }

  for (const state of ['active', 'paused', 'archived'] as const) {
    it(`shows every action with the correct availability for ${state} proxies`, async () => {
      fixture.componentRef.setInput('proxies', [{...proxy, state}]);
      await openMenu();
      expect(overlay.querySelector('[role="menuitem"]')?.textContent?.trim()).toBe('View details');
      expect(item('Copy address').disabled).toBeFalse();
      expect(item('View details').disabled).toBeFalse();
      expect(item('Check now').disabled).toBe(state !== 'active');
      expect(item('Pause').disabled).toBe(state !== 'active');
      expect(item('Activate').disabled).toBe(state === 'active');
      expect(item('Archive').disabled).toBe(state !== 'paused');
    });
  }

  it('hides admin checks but keeps restricted lifecycle actions visible and disabled', async () => {
    fixture.componentRef.setInput('lifecycleEnabled', false);
    fixture.componentRef.setInput('checkEnabled', false);
    await openMenu();
    expect(overlay.textContent).not.toContain('Check now');
    for (const label of ['Pause', 'Activate', 'Archive']) {
      expect(item(label).disabled).toBeTrue();
    }
  });

  it('opens without selecting the row and dispatches a lifecycle action', async () => {
    fixture.componentRef.setInput('selectionEnabled', true);
    const selected = spyOn(fixture.componentInstance.toggleSelection, 'emit');
    const lifecycle = spyOn(fixture.componentInstance.lifecycleChange, 'emit');
    await openMenu();
    expect(selected).not.toHaveBeenCalled();
    item('Pause').click();
    expect(lifecycle).toHaveBeenCalledWith({proxy: jasmine.objectContaining({id: 1}), state: 'paused'});
  });

  it('renders and dispatches inline actions when the optional column is selected', () => {
    fixture.componentRef.setInput('columns', ['actions_buttons']);
    fixture.componentRef.setInput('proxies', [{...proxy, state: 'paused'}]);
    const lifecycle = spyOn(fixture.componentInstance.lifecycleChange, 'emit');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.proxy-actions-trigger')).toBeNull();
    expect(fixture.nativeElement.querySelector('.proxy-lifecycle-button').textContent).toContain('Activate');
    expect(fixture.nativeElement.querySelector('.proxy-details-button')).not.toBeNull();
    fixture.nativeElement.querySelector('.proxy-archive-button').click();
    expect(lifecycle).toHaveBeenCalledWith({proxy: jasmine.objectContaining({id: 1}), state: 'archived'});
  });

  it('disables lifecycle actions while a change is pending', async () => {
    fixture.componentRef.setInput('lifecycleChangingIds', {1: true});
    await openMenu();
    for (const label of ['Pause', 'Activate', 'Archive']) {
      expect(item(label).disabled).toBeTrue();
    }
  });
});
