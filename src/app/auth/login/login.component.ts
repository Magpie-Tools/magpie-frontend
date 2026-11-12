import {HlmButton} from '@spartan-ng/helm/button';
import {HlmInput} from '@spartan-ng/helm/input';
import {HlmCheckbox} from '@spartan-ng/helm/checkbox';
import {getHttpErrorMessage} from '../../shared/http-error';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, inject, model, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { User } from '../../models/UserModel';
import { HttpService } from '../../services/http.service';
import {getAuthToken, saveAuthToken} from '../../services/authorization/auth-token-storage';
import { UserService } from '../../services/authorization/user.service';
import { AuthInterceptor } from '../../services/auth-interceptor.interceptor';
import { NotificationService } from '../../services/notification-service.service';
import { WorkspaceService } from '../../services/workspace.service';
import { LoadingComponent } from '../../ui-elements/loading/loading.component';
import {AuthComponent} from '../auth.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [HlmButton, HlmInput, HlmCheckbox,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,

    LoadingComponent,
    AuthComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnDestroy {
  loginForm: FormGroup;
  rememberPass = model(false);
  shouldRemember = false;
  autoLoginChecking = signal(false);
  readonly submitting = signal(false);
  readonly submitAttempted = signal(false);
  /** Last sign-in failure, shown in the form until the user edits a field. */
  readonly submitError = signal<string | null>(null);
  private readonly host = inject(ElementRef<HTMLElement>);
  private autoLoginTimeoutId?: ReturnType<typeof setTimeout>;
  private autoLoginIntervalId?: ReturnType<typeof setInterval>;

  constructor(
    private fb: FormBuilder,
    private http: HttpService,
    private router: Router,
    private route: ActivatedRoute,
    private notification: NotificationService,
    private workspaces: WorkspaceService,
    private userService: UserService,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });

    this.rememberPass.subscribe(res => (this.shouldRemember = res));
    this.loginForm.valueChanges.subscribe(() => this.submitError.set(null));

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const isBrowser = typeof window !== 'undefined';
    const hasToken = isBrowser && !!getAuthToken();
    if (returnUrl) {
      this.autoLoginChecking.set(true);
    } else {
      this.autoLoginChecking.set(false);
    }
    if (returnUrl && hasToken) {
      this.startAutoLoginWatcher();
    } else if (returnUrl && isBrowser && !hasToken) {
      this.autoLoginChecking.set(false);
    }
  }

  ngOnDestroy(): void {
    this.clearAutoLoginTimers();
  }

  showError(name: 'email' | 'password'): boolean {
    const control = this.loginForm.get(name);
    return !!control && control.invalid && (control.touched || this.submitAttempted());
  }

  errorMessage(name: 'email' | 'password'): string {
    const control = this.loginForm.get(name);
    if (name === 'email') {
      return control?.hasError('required') ? 'Enter your email address.' : 'Enter a valid email address, such as name@example.com.';
    }
    return 'Enter your password.';
  }

  onLogin() {
    if (this.submitting()) {
      return;
    }
    this.submitAttempted.set(true);
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      const firstInvalid = (['email', 'password'] as const).find(name => this.loginForm.get(name)?.invalid);
      setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(`#${firstInvalid}`)?.focus());
      return;
    }

    const { email, password } = this.loginForm.value;
    const user: User = { email, password };

    this.submitting.set(true);
    this.submitError.set(null);
    this.http.loginUser(user).subscribe({
      next: (response) => {
        this.submitting.set(false);
        saveAuthToken(response.token, this.shouldRemember);
        AuthInterceptor.setToken(response.token);
        this.workspaces.reset();
        UserService.setLoggedIn(true);
        UserService.setRole(response.role);
        this.userService.getAndSetRole();
        const returnUrl = typeof window !== 'undefined'
          ? window.sessionStorage.getItem('magpie-return-url')
          : null;

        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem('magpie-return-url');
        }

        const target = returnUrl && returnUrl.trim().length > 0 ? returnUrl : '/';
        this.router.navigateByUrl(target);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        UserService.setLoggedIn(false);
        const message = `Sign-in failed: ${getHttpErrorMessage(err)}`;
        this.submitError.set(message);
        this.notification.showError(message);
      },
    });
  }

  private startAutoLoginWatcher(): void {
    const timeoutMs = 10000;
    const intervalMs = 50;
    const start = Date.now();

    this.autoLoginIntervalId = setInterval(() => {
      const state = UserService.authState();
      if (state !== 'checking') {
        if (state === 'unauthenticated') {
          this.autoLoginChecking.set(false);
        }
        this.clearAutoLoginTimers();
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        this.autoLoginChecking.set(false);
        this.clearAutoLoginTimers();
      }
    }, intervalMs);

    this.autoLoginTimeoutId = setTimeout(() => {
      this.autoLoginChecking.set(false);
      this.clearAutoLoginTimers();
    }, timeoutMs);
  }

  private clearAutoLoginTimers(): void {
    if (this.autoLoginIntervalId) {
      clearInterval(this.autoLoginIntervalId);
      this.autoLoginIntervalId = undefined;
    }
    if (this.autoLoginTimeoutId) {
      clearTimeout(this.autoLoginTimeoutId);
      this.autoLoginTimeoutId = undefined;
    }
  }
}
