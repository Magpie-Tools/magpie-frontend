import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { AccountComponent } from './account.component';

describe('AccountComponent', () => {
  let component: AccountComponent;
  let fixture: ComponentFixture<AccountComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [MessageService]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the three account settings cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('.account-card');

    expect(cards.length).toBe(3);
  });

  it('tracks the password policy as the user types', () => {
    component.passwordForm.setValue({
      oldPassword: 'CurrentPassword1',
      newPassword: 'Replacement1',
      newPasswordCheck: 'Replacement1',
    });

    expect(component.metPasswordRequirementCount).toBe(component.passwordRequirements.length);
    expect(component.passwordForm.valid).toBeTrue();
  });

  it('clears destructive confirmation state when the dialog closes', () => {
    component.deleteDialogVisible = true;
    component.deletingAccount = true;
    component.deleteAccountForm.setValue({password: 'CurrentPassword1'});

    component.onDeleteDialogHide();

    expect(component.deleteDialogVisible).toBeFalse();
    expect(component.deletingAccount).toBeFalse();
    expect(component.deleteAccountForm.get('password')?.value).toBe('');
  });
});
