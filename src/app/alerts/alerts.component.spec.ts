import {ComponentFixture, TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {By} from '@angular/platform-browser';
import {BrnHoverCard, BrnHoverCardContentService} from '@spartan-ng/brain/hover-card';
import {of, Subject, throwError} from 'rxjs';
import {gsap} from 'gsap';
import {AlertsComponent} from './alerts.component';
import {AlertsService} from '../services/alerts.service';
import {WorkspaceService} from '../services/workspace.service';
import {NotificationService} from '../services/notification-service.service';
import {AlertIncident, AlertRotator, AlertRule, AlertsPage} from '../models/Alert';
import {Workspace} from '../models/Workspace';
import {provideRouter, Router} from '@angular/router';

describe('AlertsComponent', () => {
  let fixture: ComponentFixture<AlertsComponent>;
  let component: AlertsComponent;
  let api: jasmine.SpyObj<AlertsService>;
  let current: ReturnType<typeof signal<Workspace | null>>;
  let canOperate: ReturnType<typeof signal<boolean>>;
  let canAdminister: ReturnType<typeof signal<boolean>>;
  let page: AlertsPage;
  const workspace = {id: 7, name: 'Production'} as Workspace;
  const rule: AlertRule = {id: 1, revision: 1, name: 'Minimum routes', rotator_id: null, metric: 'usable_routes', threshold: 50, enabled: true, destination_ids: [2], status: 'unknown', unknown_reason: 'Waiting for evaluation', last_value: null, sample_count: 0, last_evaluated_at: null, breach_since: null, recovery_since: null, active_incident_id: null};
  const incident = (id: number): AlertIncident => ({id, rule_id: 1, rule_revision: 1, rule_name: `Incident ${id}`, scope_name: 'Production', metric: 'usable_routes', threshold: 50, opening_value: 0, closing_value: null, opened_at: '2026-10-17T09:00:00Z', closed_at: null, close_reason: ''});

  beforeEach(async () => {
    current = signal<Workspace | null>(workspace); canOperate = signal(true); canAdminister = signal(true);
    page = {rules: [{...rule}], destinations: [{id: 2, name: 'Ops', kind: 'email', enabled: true, target_configured: true, signing_configured: false, mention_mode: 'none', mention_id: ''}], incidents: [], deliveries: [], next_cursor: 0};
    api = jasmine.createSpyObj<AlertsService>('AlertsService', ['load', 'rotators', 'saveRule', 'deleteRule', 'saveDestination', 'deleteDestination', 'retryDelivery']);
    api.load.and.callFake(() => of(page)); api.rotators.and.returnValue(of([]));
    api.saveRule.and.returnValue(of(rule)); api.deleteRule.and.returnValue(of(undefined));
    api.saveDestination.and.returnValue(of(page.destinations[0])); api.deleteDestination.and.returnValue(of(undefined)); api.retryDelivery.and.returnValue(of(undefined));
    await TestBed.configureTestingModule({animationsEnabled: true, imports: [AlertsComponent], providers: [
      provideRouter([]),
      {provide: AlertsService, useValue: api},
      {provide: WorkspaceService, useValue: {current, canOperate, canAdminister}},
      {provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['showSuccess'])},
    ]}).compileComponents();
    fixture = TestBed.createComponent(AlertsComponent); component = fixture.componentInstance; fixture.detectChanges();
  });

  it('opens incident history from a notification link and keeps tab changes in the URL', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?section=history');
    fixture.detectChanges();
    expect(component.activeSection()).toBe('history');
    current.set({id: 9, name: 'Development'} as Workspace);
    fixture.detectChanges();
    expect(component.activeSection()).toBe('history');
    component.selectSection('alerts-rules');
    await fixture.whenStable();
    expect(router.url).toBe('/');
    expect(component.activeSection()).toBe('rules');
  });

  it('waits for history data before scrolling to, focusing, and highlighting the exact incident', async () => {
    spyOn(window, 'matchMedia').and.returnValue({matches: true} as MediaQueryList);
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    const request = new Subject<AlertsPage>();
    api.load.and.returnValue(request);
    component.load();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?incident=9');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scroll).not.toHaveBeenCalled();

    request.next({...page, incidents: [incident(10), incident(9)]});
    request.complete();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const target = fixture.nativeElement.querySelector('#alert-incident-9') as HTMLElement;
    expect(scroll).toHaveBeenCalledOnceWith({behavior: 'auto', block: 'center', inline: 'nearest'});
    expect(scroll.calls.mostRecent().object).toBe(target);
    expect(document.activeElement).toBe(target);
    expect(target.classList).toContain('incident--highlighted');
    expect(fixture.nativeElement.querySelector('#alert-incident-10').classList).not.toContain('incident--highlighted');
    expect(router.url).toBe('/?section=history');
  });

  it('replays the highlight for another click and does not replay it on background refresh', async () => {
    spyOn(window, 'matchMedia').and.returnValue({matches: false} as MediaQueryList);
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    page = {...page, incidents: [incident(9)]};
    component.load();
    const router = TestBed.inject(Router);
    for (let click = 0; click < 2; click++) {
      await router.navigateByUrl('/?section=history&incident=9');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.highlightedIncidentId()).toBe(9);
      expect(scroll.calls.count()).toBe(click + 1);
    }
    expect(scroll).toHaveBeenCalledWith(jasmine.objectContaining({behavior: 'smooth'}));
    component.load(0, true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scroll.calls.count()).toBe(2);
    component.selectSection('alerts-rules');
    await fixture.whenStable();
    expect(component.highlightedIncidentId()).toBeNull();
  });

  it('returns from an older history page to find the notification incident', async () => {
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    api.load.and.returnValue(of({...page, incidents: [incident(8)]}));
    component.load(50);
    api.load.and.returnValue(of({...page, incidents: [incident(101)]}));
    await TestBed.inject(Router).navigateByUrl('/?section=history&incident=101');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(api.load).toHaveBeenCalledWith(0);
    expect(component.cursor).toBe(0);
    expect(scroll.calls.mostRecent().object).toBe(fixture.nativeElement.querySelector('#alert-incident-101'));
  });

  it('finds an incident that moved to an older page since the notification loaded', async () => {
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    api.load.and.returnValues(
      of({...page, incidents: [incident(100)], next_cursor: 50}),
      of({...page, incidents: [incident(9)]}),
    );
    await TestBed.inject(Router).navigateByUrl('/?section=history&incident=9');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.load).toHaveBeenCalledWith(10);
    expect(component.cursor).toBe(10);
    expect(scroll.calls.mostRecent().object).toBe(fixture.nativeElement.querySelector('#alert-incident-9'));
  });

  it('does not highlight another incident when a link is invalid or no longer available', async () => {
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    page = {...page, incidents: [incident(10)]};
    component.load();
    const router = TestBed.inject(Router);
    for (const id of ['invalid', '-1', '1.5', '9007199254740992', '9']) {
      await router.navigateByUrl('/?section=history&incident=' + id);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.highlightedIncidentId()).toBeNull();
    }
    expect(scroll).not.toHaveBeenCalled();
  });

  it('cancels a pending incident highlight when the workspace changes', async () => {
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    const oldRequest = new Subject<AlertsPage>();
    api.load.and.returnValue(oldRequest);
    component.load();
    await TestBed.inject(Router).navigateByUrl('/?section=history&incident=9');
    api.load.and.returnValue(of({...page, incidents: [incident(9)]}));
    current.set({id: 8, name: 'Development'} as Workspace);
    fixture.detectChanges();
    await fixture.whenStable();
    oldRequest.next({...page, incidents: [incident(9)]});
    oldRequest.complete();
    expect(component.highlightedIncidentId()).toBeNull();
    expect(scroll).not.toHaveBeenCalled();
  });

  for (const progress of [0.35, 1]) {
    it(`keeps the page entrance at ${progress} when alert data arrives`, async () => {
      fixture.destroy();
      const request = new Subject<AlertsPage>();
      api.load.and.returnValue(request);
      fixture = TestBed.createComponent(AlertsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      const header: HTMLElement = fixture.nativeElement.querySelector('.alerts-context');
      const stage: HTMLElement = fixture.nativeElement.querySelector('.loading-stage');
      const entrance = gsap.getTweensOf(header)[0];
      expect(entrance).toBeDefined();
      expect(gsap.getTweensOf(stage)).toEqual([entrance]);
      entrance.pause().progress(progress);
      const initialOpacity = header.style.opacity;
      const initialTransform = header.style.transform;
      const skeleton: HTMLElement = fixture.nativeElement.querySelector('.alerts-skeleton');
      expect(skeleton).not.toBeNull();

      request.next(page);
      request.complete();
      fixture.detectChanges();
      await fixture.whenStable();

      const content: HTMLElement = fixture.nativeElement.querySelector('.loading-stage__content');
      expect(fixture.nativeElement.querySelector('.loading-stage')).toBe(stage);
      expect(entrance.progress()).toBe(progress);
      expect(header.style.opacity).toBe(initialOpacity);
      expect(header.style.transform).toBe(initialTransform);
      expect(content.querySelector('.alert-panel')).not.toBeNull();
      expect(content.style.transform).toBe('');
      expect(getComputedStyle(skeleton).position).toBe('absolute');
      expect(skeleton.classList).toContain('loading-stage__leave');
      expect(content.classList).toContain('loading-stage__enter');

      await Promise.all([...content.getAnimations(), ...skeleton.getAnimations()].map(animation => animation.finished));
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      expect(fixture.nativeElement.querySelector('.alerts-skeleton')).toBeNull();
      expect(header.style.opacity).toBe(initialOpacity);
      expect(entrance.progress()).toBe(progress);
    });
  }

  it('keeps the settled content visible during an alert refresh', async () => {
    await fixture.whenStable();
    const stage = fixture.nativeElement.querySelector('.loading-stage');
    const content: HTMLElement = fixture.nativeElement.querySelector('.loading-stage__content');
    await Promise.all(content.getAnimations().map(animation => animation.finished));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    const request = new Subject<AlertsPage>();
    api.load.and.returnValue(request);
    component.refresh();
    fixture.detectChanges();
    request.next(page);
    request.complete();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.loading-stage')).toBe(stage);
    expect(fixture.nativeElement.querySelector('.loading-stage__content')).toBe(content);
    expect(content.getAnimations()).toEqual([]);
    expect(fixture.nativeElement.querySelector('.alerts-skeleton')).toBeNull();
  });

  it('gives viewers read-only incident and rule access', () => {
    canOperate.set(false); canAdminister.set(false); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Minimum routes');
    expect(fixture.nativeElement.querySelectorAll('form').length).toBe(0);
    component.rule = {...rule}; component.saveRule(); component.saveDestination();
    expect(api.saveRule).not.toHaveBeenCalled(); expect(api.saveDestination).not.toHaveBeenCalled();
  });

  it('lets operators edit rules while keeping destinations read-only', () => {
    canAdminister.set(false); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form[aria-label="Alert rule"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('form[aria-label="Alert destination"]')).toBeNull();
    component.editDestination(page.destinations[0]); expect(component.editingDestinationId).toBeNull();
    component.rule = {...rule}; component.saveRule(); expect(api.saveRule).toHaveBeenCalled();
  });

  it('shows only attached destinations, including disabled and missing entries, on keyboard focus', async () => {
    canOperate.set(false); canAdminister.set(false);
    component.page.set({...page, rules: [{...rule, destination_ids: [2, 3, 99]}], destinations: [
      ...page.destinations,
      {...page.destinations[0], id: 3, name: 'Maintenance webhook', kind: 'webhook', enabled: false},
      {...page.destinations[0], id: 4, name: 'Unattached destination'},
    ]});
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('.delivery-count--trigger') as HTMLButtonElement;
    const hoverCard = fixture.debugElement.query(By.directive(BrnHoverCard)).injector.get(BrnHoverCardContentService);
    try {
      trigger.focus();
      await new Promise(resolve => setTimeout(resolve, 250));
      fixture.detectChanges();
      const content = document.querySelector('.destination-hover-card') as HTMLElement;
      expect(content).not.toBeNull();
      expect(content.id).toBe(trigger.getAttribute('aria-describedby')!);
      expect(content.textContent).toContain('Ops');
      expect(content.textContent).toContain('Email');
      expect(content.textContent).toContain('Maintenance webhook');
      expect(content.textContent).toContain('Disabled');
      expect(content.textContent).toContain('Destination #99');
      expect(content.textContent).toContain('No longer configured');
      expect(content.textContent).not.toContain('Unattached destination');
      expect(api.load).toHaveBeenCalledTimes(1);
    } finally {
      trigger.blur(); hoverCard.hide();
    }
  });

  it('omits blank destination secrets when editing', () => {
    component.editDestination(page.destinations[0]); component.destination.name = 'Changed'; component.saveDestination();
    expect(api.saveDestination).toHaveBeenCalledWith(2, {name: 'Changed', kind: 'email', enabled: true});
    expect(component.destination.target).toBe('');
  });

  it('clears a deleted editor and removes deleted destinations from the rule draft', () => {
    component.editRule(rule); component.editDestination(page.destinations[0]);
    component.confirmDelete.set({kind: 'destination', id: 2, name: 'Ops'});
    page = {...page, destinations: []}; component.deleteConfirmed();
    expect(component.editingDestinationId).toBeNull(); expect(component.rule.destination_ids).toEqual([]);
    component.confirmDelete.set({kind: 'rule', id: 1, name: rule.name}); page = {...page, rules: []}; component.deleteConfirmed();
    expect(component.editingRuleId).toBeNull(); expect(component.rule.name).toBe('');
  });

  it('loads and saves Discord role mentions without exposing the saved webhook', () => {
    component.editDestination({...page.destinations[0], kind: 'discord', mention_mode: 'role', mention_id: '165511591545143296'});
    expect(component.destination.target).toBe(''); expect(component.destination.mention_id).toBe('165511591545143296');
    component.saveDestination();
    expect(api.saveDestination).toHaveBeenCalledWith(2, {name: 'Ops', kind: 'discord', enabled: true, mention_mode: 'role', mention_id: '165511591545143296'});
  });

  it('clears custom IDs when mentions are turned off and resets mention settings when changing channels', () => {
    component.editDestination({...page.destinations[0], kind: 'discord', mention_mode: 'role', mention_id: '165511591545143296'});
    component.destination.mention_mode = 'none'; component.saveDestination();
    expect(api.saveDestination).toHaveBeenCalledWith(2, jasmine.objectContaining({mention_mode: 'none', mention_id: ''}));
    component.changeChannel('slack'); component.destination.mention_mode = 'user_group'; component.destination.mention_id = 'SAZ94GDB8';
    component.changeChannel('email'); expect(component.destination.mention_mode).toBe('none'); expect(component.destination.mention_id).toBe('');
  });

  it('rejects invalid or overflowing role IDs and supports Slack user groups', () => {
    component.editDestination({...page.destinations[0], kind: 'discord', mention_mode: 'role', mention_id: '165511591545143296'});
    component.destination.mention_id = '18446744073709551616'; expect(component.validMention()).toBeFalse(); component.saveDestination(); expect(api.saveDestination).not.toHaveBeenCalled();
    component.destination.mention_id = '123> @everyone'; expect(component.validMention()).toBeFalse();
    component.changeChannel('slack'); component.destination.mention_mode = 'user_group'; component.destination.mention_id = 'SAZ94GDB8'; expect(component.validMention()).toBeTrue();
    component.destination.mention_id = 'missing-prefix'; expect(component.validMention()).toBeFalse();
    expect(component.mentionOptions().map(option => option.value)).toContain('channel');
    expect(component.mentionOptions().map(option => option.value)).not.toContain('role');
  });

  it('rejects stale results after a workspace switch', () => {
    const old = new Subject<AlertsPage>(); api.load.and.returnValue(old); component.load();
    page = {...page, rules: [{...rule, name: 'Second workspace rule'}]}; api.load.and.callFake(() => of(page));
    current.set({id: 8, name: 'Second'} as Workspace); fixture.detectChanges();
    old.next({...page, rules: [{...rule, name: 'Old workspace rule'}]}); old.complete(); fixture.detectChanges();
    expect(component.page().rules[0].name).toBe('Second workspace rule');
  });

  it('shows rules and history while rotator metadata is slow or unavailable', () => {
    const metadata = new Subject<AlertRotator[]>(); api.rotators.and.returnValue(metadata);
    page = {...page, rules: [{...rule, rotator_id: 12}], incidents: [{id: 9, rule_id: 1, rule_revision: 1, rule_name: 'Open incident', scope_name: 'Production pool', metric: 'usable_routes', threshold: 50, opening_value: 0, closing_value: null, opened_at: '2026-10-09T00:00:00Z', closed_at: null, close_reason: ''}]};
    current.set({id: 8, name: 'Second'} as Workspace); fixture.detectChanges();
    expect(component.loaded()).toBeTrue(); expect(component.loading()).toBeFalse(); expect(component.rotatorsLoading()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Minimum routes'); expect(fixture.nativeElement.textContent).toContain('Open incident');
    expect(component.scopeName(12)).toBe('Rotator #12');
    metadata.error({status: 500}); fixture.detectChanges();
    expect(component.error()).toBe(''); expect(component.loaded()).toBeTrue(); expect(component.scopeName(12)).toBe('Rotator #12');
    expect(fixture.nativeElement.textContent).toContain('Retry rotator details'); expect(fixture.nativeElement.textContent).toContain('Open incident');
  });

  it('reuses metadata on history pagination, timed refresh, and rule mutations', () => {
    expect(api.rotators).toHaveBeenCalledTimes(1);
    component.load(99); component.load(0, true); component.rule = {...rule}; component.saveRule();
    expect(api.rotators).toHaveBeenCalledTimes(1);
    component.refresh(); expect(api.rotators).toHaveBeenCalledTimes(2);
    current.set({id: 8, name: 'Second'} as Workspace); fixture.detectChanges();
    expect(api.rotators).toHaveBeenCalledTimes(3);
  });

  it('retries metadata independently and keeps cached scope names on failure', () => {
    api.rotators.and.returnValue(of([{id: 12, name: 'Production pool', protocol: 'http'}])); component.loadRotators();
    api.rotators.and.returnValue(throwError(() => ({status: 500}))); component.refresh();
    expect(component.scopeName(12)).toBe('Production pool'); expect(component.rotatorsError()).toBeTrue();
    const pageLoads = api.load.calls.count();
    api.rotators.and.returnValue(of([{id: 12, name: 'Renamed pool', protocol: 'https'}])); component.loadRotators();
    expect(api.load.calls.count()).toBe(pageLoads); expect(component.scopeName(12)).toBe('Renamed pool'); expect(component.rotatorsError()).toBeFalse();
    expect(component.scopeName(13)).toBe('Deleted rotator #13');
  });

  it('discards stale metadata after a workspace switch', () => {
    const old = new Subject<AlertRotator[]>(); api.rotators.and.returnValue(old); component.loadRotators();
    api.rotators.and.returnValue(of([{id: 13, name: 'Second pool', protocol: 'https'}]));
    current.set({id: 8, name: 'Second'} as Workspace); fixture.detectChanges();
    old.next([{id: 12, name: 'Old pool', protocol: 'http'}]); old.complete();
    expect(component.rotators()).toEqual([{id: 13, name: 'Second pool', protocol: 'https'}]); expect(component.rotatorsLoading()).toBeFalse();
  });

  it('preserves a rule scope in the form when metadata is unavailable', async () => {
    api.rotators.and.returnValue(throwError(() => ({status: 500}))); component.loadRotators();
    component.editRule({...rule, rotator_id: 12}); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const scope = fixture.nativeElement.querySelector('app-select[name="scope"] [data-slot="select-trigger"]') as HTMLElement;
    expect(scope.textContent).toContain('Rotator #12'); expect(component.rule.rotator_id).toBe(12);
    component.saveRule(); expect(api.saveRule).toHaveBeenCalledWith(1, jasmine.objectContaining({rotator_id: 12}));
  });

  it('does not clear a new workspace draft when an old mutation finishes', () => {
    const save = new Subject<AlertRule>(); api.saveRule.and.returnValue(save);
    component.rule = {...rule}; component.saveRule();
    current.set({id: 8, name: 'Second'} as Workspace); fixture.detectChanges(); component.rule.name = 'New draft';
    save.next(rule); save.complete(); expect(component.rule.name).toBe('New draft'); expect(component.busy()).toBeFalse();
  });

  it('opens the matching editor tab and keeps drafts when switching sections', () => {
    component.rule.name = 'Unsaved rule';
    component.selectSection('alerts-history'); fixture.detectChanges();
    expect(component.activeSection()).toBe('history');
    expect(fixture.nativeElement.querySelector('[hlmTabsContent="alerts-history"]').hidden).toBeFalse();
    expect(fixture.nativeElement.querySelector('[hlmTabsContent="alerts-rules"]').hidden).toBeTrue();
    component.editDestination(page.destinations[0]); fixture.detectChanges();
    expect(component.activeSection()).toBe('destinations');
    expect(component.rule.name).toBe('Unsaved rule');
    component.editRule(rule); fixture.detectChanges();
    expect(component.activeSection()).toBe('rules');
    current.set({id: 8, name: 'Second'} as Workspace); fixture.detectChanges();
    expect(component.activeSection()).toBe('rules'); expect(component.rule.name).toBe('');
  });

  it('derives the open incident summary from rules when viewing older history', () => {
    component.page.set({...page, rules: [{...rule, active_incident_id: 9}, {...rule, id: 3, enabled: false, active_incident_id: null}], incidents: []});
    component.cursor = 99; fixture.detectChanges();
    expect(component.enabledRuleCount()).toBe(1); expect(component.openIncidentCount()).toBe(1);
    expect(component.statusTone({...rule, status: 'healthy', active_incident_id: 9})).toBe('danger');
  });

  it('accepts submillisecond latency thresholds and rejects fractional route counts', () => {
    component.rule = {...rule, metric: 'latency_ms', threshold: 0.5}; expect(component.validThreshold()).toBeTrue();
    component.saveRule(); expect(api.saveRule).toHaveBeenCalledWith(null, jasmine.objectContaining({metric: 'latency_ms', threshold: 0.5}));
    component.rule = {...rule, threshold: 0.5}; expect(component.validThreshold()).toBeFalse();
  });

  it('offers retries only for the latest failure with a live destination and unchanged rule', () => {
    const incident = {id: 9, rule_id: 1, rule_revision: 1, rule_name: 'Rule', scope_name: 'Production', metric: 'usable_routes' as const, threshold: 50, opening_value: 0, closing_value: null, opened_at: '2026-10-09T00:00:00Z', closed_at: null, close_reason: ''};
    const opening = {id: 10, incident_id: 9, destination_id: 2, destination_name: 'Ops', kind: 'email' as const, event: 'opened' as const, status: 'failed', attempts: 4, last_error: 'SMTP delivery failed', sent_at: null};
    component.page.set({...page, incidents: [incident], deliveries: [opening]}); expect(component.canRetry(opening, incident)).toBeTrue();
    component.page.set({...page, incidents: [incident], deliveries: [opening, {...opening, id: 11, event: 'recovered', status: 'sent'}]}); expect(component.canRetry(opening, incident)).toBeFalse();
    component.page.set({...page, deliveries: [opening]}); expect(component.canRetry(opening, {...incident, close_reason: 'configuration_changed'})).toBeFalse();
    component.page.set({...page, destinations: [], deliveries: [opening]}); expect(component.canRetry(opening, incident)).toBeFalse();
    component.page.set({...page, rules: [{...rule, revision: 2}], deliveries: [opening]}); expect(component.canRetry(opening, incident)).toBeFalse();
    component.page.set({...page, rules: [], deliveries: [opening]}); expect(component.canRetry(opening, incident)).toBeFalse();
  });
});
