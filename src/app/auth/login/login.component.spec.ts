import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, Subject, throwError } from 'rxjs';

import { LoginComponent } from './login.component';
import { HttpService } from '../../services/http.service';
import { NotificationService } from '../../services/notification-service.service';
import { ThemeService } from '../../services/theme.service';
import { WorkspaceService } from '../../services/workspace.service';
import { AuthInterceptor } from '../../services/auth-interceptor.interceptor';
import { UserService } from '../../services/authorization/user.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let loginUserSpy: jasmine.Spy;
  let getUserProfileSpy: jasmine.Spy;
  let showErrorSpy: jasmine.Spy;
  let resetWorkspacesSpy: jasmine.Spy;

  beforeEach(async () => {
    window.localStorage.removeItem('magpie-jwt');
    window.sessionStorage.removeItem('magpie-jwt');
    UserService.setLoggedIn(false);
    spyOn(UserService, 'setRole');
    loginUserSpy = jasmine.createSpy('loginUser');
    getUserProfileSpy = jasmine.createSpy('getUserProfile').and.returnValue(of({email: 'member@example.test', role: 'user'}));
    showErrorSpy = jasmine.createSpy('showError');
    resetWorkspacesSpy = jasmine.createSpy('reset');

    await TestBed.configureTestingModule({
      imports: [LoginComponent, RouterTestingModule],
      providers: [
        {
          provide: HttpService,
          useValue: {
            loginUser: loginUserSpy,
            getUserProfile: getUserProfileSpy,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        {
          provide: ThemeService,
          useValue: {
            theme: () => 'green',
          },
        },
        {
          provide: NotificationService,
          useValue: {
            showError: showErrorSpy,
          },
        },
        {
          provide: WorkspaceService,
          useValue: {
            reset: resetWorkspacesSpy,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    AuthInterceptor.setToken('');
    UserService.setLoggedIn(false);
    window.localStorage.removeItem('magpie-jwt');
    window.sessionStorage.removeItem('magpie-jwt');
    window.sessionStorage.removeItem('magpie-return-url');
  });

  it('loads the email after a fresh login without recreating the user service', () => {
    const profile = new Subject<{email: string; role: string}>();
    getUserProfileSpy.and.returnValue(profile);
    const userService = TestBed.inject(UserService);
    expect(userService.email()).toBe('');
    expect(getUserProfileSpy).not.toHaveBeenCalled();
    loginUserSpy.and.returnValue(of({token: 'fresh-token', role: 'user'}));
    component.loginForm.setValue({email: 'member@example.test', password: 'password123'});

    component.onLogin();

    expect(getUserProfileSpy).toHaveBeenCalledTimes(1);
    profile.next({email: 'member@example.test', role: 'user'});
    profile.complete();
    expect(userService.email()).toBe('member@example.test');
    expect(UserService.authState()).toBe('authenticated');
  });

  it('should reset workspace state before entering the new account', () => {
    loginUserSpy.and.returnValue(of({token: 'new-account-token', role: 'user'}));
    component.loginForm.setValue({
      email: 'new-account@example.com',
      password: 'password123',
    });

    component.onLogin();

    expect(resetWorkspacesSpy).toHaveBeenCalledTimes(1);
    expect(UserService.authState()).toBe('authenticated');
    expect(window.sessionStorage.getItem('magpie-jwt')).toBe('new-account-token');
    expect(window.localStorage.getItem('magpie-jwt')).toBeNull();
  });

  it('should persist a remembered login across browser sessions', () => {
    loginUserSpy.and.returnValue(of({token: 'remembered-token', role: 'user'}));
    component.rememberPass.set(true);
    component.loginForm.setValue({
      email: 'remembered@example.com',
      password: 'password123',
    });

    component.onLogin();

    expect(window.localStorage.getItem('magpie-jwt')).toBe('remembered-token');
    expect(window.sessionStorage.getItem('magpie-jwt')).toBeNull();
  });

  it('should show the backend login error detail', () => {
    loginUserSpy.and.returnValue(
      throwError(() => new HttpErrorResponse({
        status: 429,
        error: { error: 'Too many login attempts. Please try again later.' },
      }))
    );
    component.loginForm.setValue({
      email: 'test@example.com',
      password: 'password123',
    });

    component.onLogin();

    expect(showErrorSpy).toHaveBeenCalledWith('Login failed: Too many login attempts. Please try again later.');
  });

  it('should fall back to a friendly network error message', () => {
    loginUserSpy.and.returnValue(
      throwError(() => new HttpErrorResponse({
        status: 0,
        error: new ProgressEvent('error'),
      }))
    );
    component.loginForm.setValue({
      email: 'test@example.com',
      password: 'password123',
    });

    component.onLogin();

    expect(showErrorSpy).toHaveBeenCalledWith('Login failed: Unable to reach the server');
    expect(getUserProfileSpy).not.toHaveBeenCalled();
  });
});
