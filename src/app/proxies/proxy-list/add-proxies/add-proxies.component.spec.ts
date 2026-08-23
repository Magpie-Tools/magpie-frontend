import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { AddProxiesComponent } from './add-proxies.component';

describe('AddProxiesComponent', () => {
  let component: AddProxiesComponent;
  let fixture: ComponentFixture<AddProxiesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddProxiesComponent],
      providers: [MessageService]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddProxiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('counts bracketed IPv6 proxies and authentication correctly', () => {
    component.onTextareaChange([
      '192.0.2.1:8080',
      '[2001:db8::1]:8080',
      'user:pass@[2001:db8::2]:8080',
      '[2001:db8::3]:8080:user:pass',
    ].join('\n'));

    expect(component.getProxiesWithoutAuthCount()).toBe(2);
    expect(component.getProxiesWithAuthCount()).toBe(2);
    expect(component.getUniqueProxiesCount()).toBe(4);
  });
});
