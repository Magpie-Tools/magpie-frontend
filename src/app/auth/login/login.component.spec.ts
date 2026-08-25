import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

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
  let showErrorSpy: jasmine.Spy;
  let resetWorkspacesSpy: jasmine.Spy;

  beforeEach(async () => {
    loginUserSpy = jasmine.createSpy('loginUser');
    showErrorSpy = jasmine.createSpy('showError');
    resetWorkspacesSpy = jasmine.createSpy('reset');

    await TestBed.configureTestingModule({
      imports: [LoginComponent, RouterTestingModule],
      providers: [
        {
          provide: HttpService,
          useValue: {
            loginUser: loginUserSpy,
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
    UserService.setRole('user');
    window.localStorage.removeItem('magpie-jwt');
    window.sessionStorage.removeItem('magpie-return-url');
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
  });
});
