import {TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {NotificationService} from '../notification-service.service';
import {WorkspaceService} from '../workspace.service';
import {AuthInterceptor} from '../auth-interceptor.interceptor';
import {HttpService} from '../http.service';
import {UserService} from './user.service';

describe('UserService', () => {
  let service: UserService;
  let navigate: jasmine.Spy;
  let resetWorkspaces: jasmine.Spy;

  beforeEach(() => {
    window.localStorage.removeItem('magpie-jwt');
    window.localStorage.removeItem('magpie-workspace-id');
    navigate = jasmine.createSpy('navigate');
    resetWorkspaces = jasmine.createSpy('reset');

    TestBed.configureTestingModule({
      providers: [
        UserService,
        {provide: HttpService, useValue: {}},
        {provide: Router, useValue: {navigate}},
        {provide: NotificationService, useValue: {}},
        {provide: WorkspaceService, useValue: {reset: resetWorkspaces}},
      ],
    });

    service = TestBed.inject(UserService);
  });

  afterEach(() => {
    AuthInterceptor.setToken('');
    UserService.setLoggedIn(false);
    UserService.setRole('user');
    window.localStorage.removeItem('magpie-jwt');
    window.localStorage.removeItem('magpie-workspace-id');
  });

  it('resets workspace state when logging out', () => {
    window.localStorage.setItem('magpie-jwt', 'old-account-token');
    window.localStorage.setItem('magpie-workspace-id', '41');
    UserService.setLoggedIn(true);

    service.logoutAndRedirect();

    expect(resetWorkspaces).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('magpie-jwt')).toBeNull();
    expect(UserService.authState()).toBe('unauthenticated');
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
