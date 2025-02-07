import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProxyListComponent } from './proxy-list.component';

describe('ProxyListComponent', () => {
  let component: ProxyListComponent;
  let fixture: ComponentFixture<ProxyListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProxyListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProxyListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
