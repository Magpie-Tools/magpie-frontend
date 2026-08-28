import { AfterViewInit, Component, ElementRef, OnDestroy, Signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';

import { ReactiveFormsModule } from '@angular/forms';
import {HttpService} from '../services/http.service';
import {ChangePassword} from '../models/ChangePassword';
import {NotificationService} from '../services/notification-service.service';

import {ThemeService, ThemeName} from '../services/theme.service';
import {Password} from 'primeng/password';
import {DeleteAccount} from '../models/DeleteAccount';
import {UserService} from '../services/authorization/user.service';
import {DialogModule} from 'primeng/dialog';
import { passwordMinLength, passwordPolicyMessages, passwordPolicyValidators } from '../auth/password-policy';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

@Component({
    selector: 'app-account',
  imports: [
    ReactiveFormsModule,
    Password,
    DialogModule,
  ],
    templateUrl: './account.component.html',
    styleUrls: ['./account.component.scss']
})
export class AccountComponent implements AfterViewInit, OnDestroy {
  passwordForm: FormGroup;
  deleteAccountForm: FormGroup;
  deleteDialogVisible = false;
  readonly themes: ThemeName[];
  readonly currentTheme: Signal<ThemeName>;
  private readonly purpleActivationTarget = 10;
  private purpleActivationCount = 0;
  private animationContext?: gsap.Context;
  deletingAccount = false;
  private readonly themeLabels: Record<ThemeName, string> = {
    green: 'Green',
    blue: 'Blue',
    red: 'Red',
    purple: 'Purple'
  };

  private readonly themePreviewColors: Record<ThemeName, string> = {
    green: '#348566',
    blue: '#3b82f6',
    red: '#dc2626',
    purple: '#8b5cf6'
  };
  readonly passwordRequirements = passwordPolicyMessages();

  constructor(private fb: FormBuilder,
              private http: HttpService,
              private themeService: ThemeService,
              private userService: UserService,
              private notification: NotificationService,
              private elementRef: ElementRef<HTMLElement>) {
    this.passwordForm = this.fb.group(
      {
        oldPassword: ['', [Validators.required]],
        newPassword: ['', passwordPolicyValidators()],
        newPasswordCheck: ['', [Validators.required]],
      },
      { validators: this.passwordsMatchValidator }
    );

    this.deleteAccountForm = this.fb.group({
      password: ['', [Validators.required]],
    });

    this.themes = this.themeService.themes;
    this.currentTheme = this.themeService.theme;
  }

  ngAfterViewInit(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const host = this.elementRef.nativeElement;
    const scrollContainer = host.closest('main') as HTMLElement | null;
    const scroller = scrollContainer ?? undefined;

    this.animationContext = gsap.context(() => {
      gsap.fromTo(
        '.account-context',
        {opacity: 0, y: 20},
        {opacity: 1, y: 0, duration: 0.65, ease: 'power3.out', clearProps: 'transform'},
      );

      gsap.utils.toArray<HTMLElement>('.account-card').forEach((card, index) => {
        gsap.from(card, {
          opacity: 0,
          y: 30,
          scale: 0.985,
          duration: 0.72,
          delay: index * 0.045,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            scroller,
            start: 'top 94%',
            toggleActions: 'play none none reverse',
          },
        });
      });

      gsap.fromTo(
        '.account-context__copy p',
        {opacity: 0.38},
        {
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: '.account-context',
            scroller,
            start: 'top 96%',
            end: 'bottom 74%',
            scrub: 0.35,
          },
        },
      );
    }, host);

    requestAnimationFrame(() => ScrollTrigger.refresh());
  }

  ngOnDestroy(): void {
    this.animationContext?.revert();
  }

  setTheme(theme: ThemeName): void {
    this.themeService.setTheme(theme);
    if (theme === 'purple') {
      this.handlePurpleSecret();
      return;
    }
    this.resetPurpleActivation();
  }

  labelFor(theme: ThemeName): string {
    return this.themeLabels[theme];
  }

  colorFor(theme: ThemeName): string {
    return this.themePreviewColors[theme];
  }

  passwordRequirementMet(index: number): boolean {
    const password = String(this.passwordForm.get('newPassword')?.value ?? '');
    if (!password) {
      return false;
    }

    switch (index) {
      case 0:
        return password.length >= passwordMinLength;
      case 1:
        return /[A-Z]/.test(password);
      case 2:
        return /[a-z]/.test(password);
      case 3:
        return /\d/.test(password);
      case 4:
        return !/\s/.test(password);
      default:
        return false;
    }
  }

  get metPasswordRequirementCount(): number {
    return this.passwordRequirements.filter((_, index) => this.passwordRequirementMet(index)).length;
  }

  passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
    const newPass = group.get('newPassword')?.value;
    const newPassCheck = group.get('newPasswordCheck')?.value;
    return newPass && newPassCheck && newPass === newPassCheck
      ? null
      : { passwordsMismatch: true };
  }

  onSubmit(): void {
    if (this.passwordForm.valid) {

      const changePass: ChangePassword = this.passwordForm.value

      this.http.changePassword(changePass).subscribe({
        next:  res  => this.notification.showInfo(res),
        error: err => this.notification.showError("There has been an error while changing the password! " + err.error.message)
      });

      // this.passwordForm.reset();
    } else {
      this.passwordForm.markAllAsTouched();
    }
  }

  onDeleteAccount(): void {
    if (this.deleteAccountForm.valid) {
      const payload: DeleteAccount = this.deleteAccountForm.value;
      this.deletingAccount = true;

      this.http.deleteAccount(payload).subscribe({
        next: res => {
          this.notification.showSuccess(res);
          this.userService.logoutAndRedirect();
        },
        error: err => {
          this.deletingAccount = false;
          const detail = err?.error?.message ?? err?.error?.error ?? 'Please try again.';
          this.notification.showError("There has been an error while deleting the account! " + detail);
        }
      });
    } else {
      this.deleteAccountForm.markAllAsTouched();
    }
  }

  openDeleteDialog(): void {
    this.deleteDialogVisible = true;
  }

  closeDeleteDialog(): void {
    this.deleteDialogVisible = false;
  }

  onDeleteDialogHide(): void {
    this.deleteDialogVisible = false;
    this.deletingAccount = false;
    this.deleteAccountForm.reset({ password: '' });
  }

  private handlePurpleSecret(): void {
    this.purpleActivationCount += 1;
    const remaining = this.purpleActivationTarget - this.purpleActivationCount;

    if (remaining > 0 && remaining <= 3) {
      this.notification.showInfo(`${remaining}...`);
    }

    if (remaining <= 0) {
      this.resetPurpleActivation();
      this.redirectToGithub();
    }
  }

  private resetPurpleActivation(): void {
    this.purpleActivationCount = 0;
  }

  private redirectToGithub(): void {
    if (typeof globalThis !== 'undefined' && globalThis.location) {
      globalThis.location.href = 'https://github.com/Magpie-Tools';
    }
  }
}
