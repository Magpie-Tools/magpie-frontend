import {ComponentFixture, TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {of, Subject, throwError} from 'rxjs';
import {AlertsComponent} from './alerts.component';
import {AlertsService} from '../services/alerts.service';
import {WorkspaceService} from '../services/workspace.service';
import {NotificationService} from '../services/notification-service.service';
import {AlertRotator, AlertRule, AlertsPage} from '../models/Alert';
import {Workspace} from '../models/Workspace';

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

  beforeEach(async () => {
    current = signal<Workspace | null>(workspace); canOperate = signal(true); canAdminister = signal(true);
    page = {rules: [{...rule}], destinations: [{id: 2, name: 'Ops', kind: 'email', enabled: true, target_configured: true, signing_configured: false, mention_mode: 'none', mention_id: ''}], incidents: [], deliveries: [], next_cursor: 0};
    api = jasmine.createSpyObj<AlertsService>('AlertsService', ['load', 'rotators', 'saveRule', 'deleteRule', 'saveDestination', 'deleteDestination', 'retryDelivery']);
    api.load.and.callFake(() => of(page)); api.rotators.and.returnValue(of([]));
    api.saveRule.and.returnValue(of(rule)); api.deleteRule.and.returnValue(of(undefined));
    api.saveDestination.and.returnValue(of(page.destinations[0])); api.deleteDestination.and.returnValue(of(undefined)); api.retryDelivery.and.returnValue(of(undefined));
    await TestBed.configureTestingModule({imports: [AlertsComponent], providers: [
      {provide: AlertsService, useValue: api},
      {provide: WorkspaceService, useValue: {current, canOperate, canAdminister}},
      {provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['showSuccess'])},
    ]}).compileComponents();
    fixture = TestBed.createComponent(AlertsComponent); component = fixture.componentInstance; fixture.detectChanges();
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
    const scope = fixture.nativeElement.querySelector('select[name="scope"]') as HTMLSelectElement;
    expect(scope.selectedOptions[0].textContent).toContain('Rotator #12'); expect(component.rule.rotator_id).toBe(12);
    component.saveRule(); expect(api.saveRule).toHaveBeenCalledWith(1, jasmine.objectContaining({rotator_id: 12}));
  });

  it('does not clear a new workspace draft when an old mutation finishes', () => {
    const save = new Subject<AlertRule>(); api.saveRule.and.returnValue(save);
    component.rule = {...rule}; component.saveRule();
    current.set({id: 8, name: 'Second'} as Workspace); fixture.detectChanges(); component.rule.name = 'New draft';
    save.next(rule); save.complete(); expect(component.rule.name).toBe('New draft'); expect(component.busy()).toBeFalse();
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
