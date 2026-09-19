import {ComponentFixture, TestBed} from '@angular/core/testing';

import {BehaviorSubject, of} from 'rxjs';
import {RouterTestingModule} from '@angular/router/testing';
import {ProxyListComponent} from './proxy-list.component';
import {HttpService} from '../../services/http.service';
import {SettingsService} from '../../services/settings.service';
import {UserService} from '../../services/authorization/user.service';
import {ProxyInfo} from '../../models/ProxyInfo';
import {WorkspaceService} from '../../services/workspace.service';

describe('ProxyListComponent', () => {
  let component: ProxyListComponent;
  let fixture: ComponentFixture<ProxyListComponent>;
  let httpServiceStub: {
    getProxyPage: jasmine.Spy;
    getProxyFilterOptions: jasmine.Spy;
    getProxyTags: jasmine.Spy;
    replaceProxyTags: jasmine.Spy;
    requeueProxy: jasmine.Spy;
    updateManagedProxyLifecycle: jasmine.Spy;
  };

  beforeEach(async () => {
    httpServiceStub = {
      getProxyPage: jasmine.createSpy('getProxyPage').and.returnValue(of({proxies: [], total: 0})),
      getProxyFilterOptions: jasmine.createSpy('getProxyFilterOptions').and.returnValue(of({countries: [], types: [], anonymityLevels: [], tags: []})),
      getProxyTags: jasmine.createSpy('getProxyTags').and.returnValue(of([])),
      replaceProxyTags: jasmine.createSpy('replaceProxyTags').and.returnValue(of([])),
      updateManagedProxyLifecycle: jasmine.createSpy('updateManagedProxyLifecycle').and.returnValue(of({})),
      requeueProxy: jasmine.createSpy('requeueProxy').and.returnValue(of({message: 'Proxy queued successfully', proxy_id: 1})),
    };
    const settingsServiceStub = {
      getUserSettings: jasmine.createSpy('getUserSettings').and.returnValue(undefined),
      userSettings$: of(undefined),
      saveProxyListColumns: jasmine.createSpy('saveProxyListColumns').and.returnValue(of({message: 'ok'})),
    } satisfies Partial<SettingsService>;
    const role$ = new BehaviorSubject<string | undefined>('user');
    const userServiceStub = {
      role$: role$.asObservable(),
    } satisfies Partial<UserService>;

    await TestBed.configureTestingModule({
      imports: [ProxyListComponent, RouterTestingModule],
      providers: [
        {provide: HttpService, useValue: httpServiceStub},
        {provide: SettingsService, useValue: settingsServiceStub},
        {provide: UserService, useValue: userServiceStub},
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProxyListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('applies lifecycle filters from page one and clears them', () => {
    component.page.set(3);
    component.filterForm.patchValue({states: ['paused', 'archived']});
    component.applyFilters();
    expect(component.page()).toBe(1);
    expect(httpServiceStub.getProxyPage).toHaveBeenCalledWith(1, jasmine.objectContaining({
      filters: {states: ['paused', 'archived']},
    }));
    component.clearFilters();
    expect(component.filterForm.get('states')?.value).toEqual([]);
    expect(component.appliedFilters().states).toEqual([]);
    expect(httpServiceStub.getProxyPage).toHaveBeenCalledWith(1, jasmine.objectContaining({
      filters: undefined,
    }));
  });

  it('reloads a filtered list after a route changes lifecycle state', () => {
    const workspaces = TestBed.inject(WorkspaceService);
    spyOn(workspaces, 'canOperate').and.returnValue(true);
    spyOn(workspaces, 'refresh').and.returnValue(of([]));
    component.filterForm.patchValue({states: ['paused', 'archived']});
    component.applyFilters();
    httpServiceStub.getProxyPage.calls.reset();
    component.onLifecycleChange({proxy: {id: 42, state: 'paused'} as ProxyInfo, state: 'archived'});
    expect(httpServiceStub.updateManagedProxyLifecycle).toHaveBeenCalledWith(42, 'archived');
    expect(httpServiceStub.getProxyPage).toHaveBeenCalledWith(1, jasmine.objectContaining({filters: {states: ['paused', 'archived']}}));
  });

  it('shows the lifecycle selector in the filter panel', async () => {
    component.toggleFilterPanel();
    fixture.detectChanges();
    await fixture.whenStable();
    const element = document.querySelector('hlm-popover-content')!;
    expect(element.querySelector('label[for="filterState"]')?.textContent).toContain('Lifecycle state');
    const lifecycle = element.querySelector('.filter-column--left app-select[formControlName="states"]');
    const type = element.querySelector('app-select[formControlName="types"]');
    expect(lifecycle).not.toBeNull();
    expect(type!.compareDocumentPosition(lifecycle!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('restores saved lifecycle filters and defaults older saved filters to all states', () => {
    const normalize = (component as any).normalizeStoredFilters.bind(component);
    expect(normalize({states: ['paused', 'archived']}).states).toEqual(['paused', 'archived']);
    expect(normalize({state: 'archived'}).states).toEqual(['archived']);
    expect(normalize({status: 'alive'}).states).toEqual([]);
    expect(normalize({state: 'invalid'}).states).toEqual([]);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the redesigned inventory workbench', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.summary-card')).toBeNull();
    expect(element.querySelector('.inventory-toolbar')).not.toBeNull();
    expect(element.querySelector('.inventory-card')).not.toBeNull();
  });

  async function openFilters(): Promise<HTMLButtonElement> {
    const trigger = fixture.nativeElement.querySelector('button[hlmPopoverTrigger]') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    return trigger;
  }

  it('opens on click and closes on Escape, restoring focus to the trigger', async () => {
    const trigger = await openFilters();
    expect(component.filterPanelOpen()).toBeTrue();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    document.querySelector('hlm-popover-content')!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    await fixture.whenStable();
    expect(component.filterPanelOpen()).toBeFalse();
    // Focus returns after the popover's exit animation removes its content.
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps filters open while selecting a nested dropdown option', async () => {
    await openFilters();
    component.filterForm.patchValue({states: []});
    fixture.detectChanges();
    const select = document.querySelector('app-select[formControlName="states"] button') as HTMLButtonElement;
    select.click();
    await fixture.whenStable();
    const option = document.querySelector('.app-select-overlay [role="option"]') as HTMLElement;
    expect(option).not.toBeNull();
    option.click();
    await fixture.whenStable();
    expect(component.filterPanelOpen()).toBeTrue();
    expect(component.filterForm.get('states')?.value.length).toBe(1);
  });

  it('closes filters when clicking outside the popover', async () => {
    await openFilters();
    document.body.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    await fixture.whenStable();
    expect(component.filterPanelOpen()).toBeFalse();
  });

  it('closes the column panel when opening the filter panel', () => {
    component.columnPanelOpen.set(true);

    component.toggleFilterPanel();

    expect(component.filterPanelOpen()).toBeTrue();
    expect(component.columnPanelOpen()).toBeFalse();
  });

  it('closes the filter panel when opening the column panel', () => {
    component.filterPanelOpen.set(true);

    component.openColumnPanel();

    expect(component.columnPanelOpen()).toBeTrue();
    expect(component.filterPanelOpen()).toBeFalse();
  });

  it('reloads the first page with server sort parameters when sorting a column', () => {
    httpServiceStub.getProxyPage.calls.reset();
    component.page.set(3);
    component.pageSize.set(40);

    component.onSort({field: 'reputation', order: -1});

    expect(component.page()).toBe(1);
    expect(component.sortField()).toBe('reputation');
    expect(component.sortOrder()).toBe(-1);
    expect(httpServiceStub.getProxyPage).toHaveBeenCalledWith(1, jasmine.objectContaining({
      rows: 40,
      sortField: 'reputation',
      sortOrder: -1,
    }));
  });

  it('clears the sort on the third click of the same column', () => {
    component.sortField.set('reputation');
    component.sortOrder.set(-1);
    httpServiceStub.getProxyPage.calls.reset();

    component.onLazyLoad({first: 0, rows: 40, sortField: 'reputation', sortOrder: 1});
    component.onSort({field: 'reputation', order: 1});

    expect(component.sortField()).toBeNull();
    expect(component.sortOrder()).toBeNull();
    expect(httpServiceStub.getProxyPage).toHaveBeenCalledWith(1, jasmine.objectContaining({
      sortField: null,
      sortOrder: null,
    }));
  });

  it('replaces a proxy tag selection and updates the row in place', () => {
    const proxy: ProxyInfo = {
      id: 42,
      ip: 'gateway.provider.example',
      port: 8080,
      estimated_type: 'http',
      response_time: 120,
      country: 'DE',
      anonymity_level: 'elite',
      alive: true,
      latest_check: new Date(),
      tags: [],
    };
    const assignedTags = [{id: 7, name: 'Residential', color: '#22c55e'}];
    httpServiceStub.replaceProxyTags.and.returnValue(of(assignedTags));
    component.dataSource.set([proxy]);

    component.onTagSelectionChange({proxy, tagIds: [7]});

    expect(httpServiceStub.replaceProxyTags).toHaveBeenCalledWith(42, [7]);
    expect(component.dataSource()[0].tags).toEqual(assignedTags);
    expect(component.savingTagProxyIds()[42]).toBeUndefined();
  });
});
