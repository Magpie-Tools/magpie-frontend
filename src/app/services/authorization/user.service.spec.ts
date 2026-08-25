import {TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {of} from 'rxjs';
import {NotificationService} from '../notification-service.service';
import {WorkspaceService} from '../workspace.service';
import {AuthInterceptor} from '../auth-interceptor.interceptor';
import {HttpService} from '../http.service';
import {UserService} from './user.service';

describe('UserService', () => {
  let service: UserService;
  let navigate: jasmine.Spy;
  let resetWorkspaces: jasmine.Spy;
  let getUserRole: jasmine.Spy;

  beforeEach(() => {
    window.localStorage.removeItem('magpie-jwt');
    window.sessionStorage.removeItem('magpie-jwt');
    window.localStorage.removeItem('magpie-workspace-id');
    UserService.setLoggedIn(false);
    spyOn(UserService, 'setRole');
    navigate = jasmine.createSpy('navigate');
    resetWorkspaces = jasmine.createSpy('reset');
    getUserRole = jasmine.createSpy('getUserRole').and.returnValue(of('user'));

    TestBed.configureTestingModule({
      providers: [
        UserService,
        {provide: HttpService, useValue: {getUserRole}},
        {provide: Router, useValue: {navigate}},
        {provide: NotificationService, useValue: {}},
        {provide: WorkspaceService, useValue: {reset: resetWorkspaces}},
      ],
    });

  });

  afterEach(() => {
    AuthInterceptor.setToken('');
    UserService.setLoggedIn(false);
    window.localStorage.removeItem('magpie-jwt');
    window.sessionStorage.removeItem('magpie-jwt');
    window.localStorage.removeItem('magpie-workspace-id');
  });

  it('resets workspace state when logging out', () => {
    service = TestBed.inject(UserService);
    window.localStorage.setItem('magpie-jwt', 'old-account-token');
    window.sessionStorage.setItem('magpie-jwt', 'old-tab-token');
    window.localStorage.setItem('magpie-workspace-id', '41');
    UserService.setLoggedIn(true);

    service.logoutAndRedirect();

    expect(resetWorkspaces).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('magpie-jwt')).toBeNull();
    expect(window.sessionStorage.getItem('magpie-jwt')).toBeNull();
    expect(UserService.authState()).toBe('unauthenticated');
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('restores a non-remembered session after a page reload', () => {
    window.sessionStorage.setItem('magpie-jwt', 'current-tab-token');

    service = TestBed.inject(UserService);

    expect(service).toBeTruthy();
    expect(getUserRole).toHaveBeenCalledTimes(1);
    expect(UserService.authState()).toBe('authenticated');
  });
});
