import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProxyHistoryCardComponent } from './proxy-history-card.component';

describe('ProxyHistoryCardComponent', () => {
  let component: ProxyHistoryCardComponent;
  let fixture: ComponentFixture<ProxyHistoryCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProxyHistoryCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProxyHistoryCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
