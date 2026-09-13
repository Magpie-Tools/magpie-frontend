import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavbarComponent } from './navbar.component';
import {provideRouter, Router} from '@angular/router';
import {UserService} from '../services/authorization/user.service';
import {OverlayContainer} from '@angular/cdk/overlay';
import {BreakpointObserver} from '@angular/cdk/layout';
import {BehaviorSubject} from 'rxjs';
import {By} from '@angular/platform-browser';
import {HlmDropdownMenuTrigger} from '@spartan-ng/helm/dropdown-menu';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let overlay: OverlayContainer;
  let mobile: BehaviorSubject<{matches: boolean}>;
  let logout: jasmine.Spy;

  beforeEach(async () => {
    mobile = new BehaviorSubject<{matches: boolean}>({matches: false});
    logout = jasmine.createSpy('logoutAndRedirect');
    spyOn(window, 'matchMedia').and.returnValue({matches: true} as MediaQueryList);
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: {logoutAndRedirect: logout, email: () => 'member@example.test'} },
        { provide: BreakpointObserver, useValue: {observe: () => mobile} },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    overlay = TestBed.inject(OverlayContainer);
  });

  async function openMenu(): Promise<HTMLElement> {
    fixture.nativeElement.querySelector('.account-trigger').click();
    await fixture.whenStable();
    return overlay.getContainerElement().querySelector<HTMLElement>('[role="menu"]')!;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens the account actions beside the desktop sidebar', async () => {
    const menu = await openMenu();
    expect(menu).not.toBeNull();
    expect(Array.from(menu.querySelectorAll('[role="menuitem"]'), item => item.textContent!.trim()))
      .toEqual(['Account', 'Workspace', 'Releases', 'Sign out']);
    const trigger = fixture.debugElement.query(By.directive(HlmDropdownMenuTrigger)).injector.get(HlmDropdownMenuTrigger);
    expect(trigger.side()).toBe('right');
    expect(trigger.align()).toBe('end');
    expect(fixture.nativeElement.querySelector('.account-trigger').getAttribute('aria-expanded')).toBe('true');
  });

  it('marks only the current account menu destination as active as navigation changes', async () => {
    const router = TestBed.inject(Router);
    router.resetConfig([{path: '**', children: []}]);
    await router.navigateByUrl('/notifications');
    const menu = await openMenu();

    for (const path of ['/notifications', '/account', '/workspace', '/proxies']) {
      await router.navigateByUrl(path);
      fixture.detectChanges();
      await fixture.whenStable();
      const active = menu.querySelectorAll('.account-menu__item--active');
      expect(active.length).toBe(path === '/proxies' ? 0 : 1);
      expect(menu.querySelector('[aria-current="page"]')?.getAttribute('href') ?? null)
        .toBe(path === '/proxies' ? null : path);
    }
  });

  it('positions the menu above the trigger on narrow screens', () => {
    mobile.next({matches: true});
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.directive(HlmDropdownMenuTrigger)).injector.get(HlmDropdownMenuTrigger);
    expect(trigger.side()).toBe('top');
    expect(trigger.align()).toBe('start');
  });

  it('supports arrow navigation and returns focus on Escape', async () => {
    const menu = await openMenu();
    const items = menu.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items[0].focus();
    items[0].dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', keyCode: 40, bubbles: true}));
    expect(document.activeElement).toBe(items[1]);
    items[1].dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', keyCode: 27, bubbles: true}));
    await fixture.whenStable();
    expect(overlay.getContainerElement().querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.account-trigger'));
  });

  it('closes the menu when navigating to account settings', async () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    const menu = await openMenu();
    menu.querySelector<HTMLAnchorElement>('a[href="/account"]')!.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalled();
    expect(overlay.getContainerElement().querySelector('[role="menu"]')).toBeNull();
  });

  it('signs out once and closes the menu', async () => {
    const menu = await openMenu();
    menu.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(overlay.getContainerElement().querySelector('[role="menu"]')).toBeNull();
  });
});
