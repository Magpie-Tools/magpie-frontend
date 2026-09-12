import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { UserService } from './services/authorization/user.service';

import {provideRouter} from '@angular/router';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: {} },
      ],
    }).compileComponents();
  });

  it('constructs the session service even without rendering a routed view', () => {
    const initializeSession = jasmine.createSpy('initializeSession').and.returnValue({});
    TestBed.overrideProvider(UserService, {useFactory: initializeSession});
    TestBed.createComponent(AppComponent);
    expect(initializeSession).toHaveBeenCalledTimes(1);
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'frontend' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('Magpie');
  });

  it('should render without crashing', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled).toBeTruthy();
  });
});
