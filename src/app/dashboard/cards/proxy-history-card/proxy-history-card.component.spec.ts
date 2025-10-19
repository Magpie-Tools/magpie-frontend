import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

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

  it('emits refresh event when the refresh button is clicked', () => {
    const refreshSpy = spyOn(component.refresh, 'emit');
    const button = fixture.debugElement.query(By.css('p-button'));

    button.triggerEventHandler('onClick', new MouseEvent('click'));

    expect(refreshSpy).toHaveBeenCalled();
  });

  it('does not emit refresh event when already refreshing', () => {
    const refreshSpy = spyOn(component.refresh, 'emit');
    component.refreshing = true;

    component.onRefreshClick();

    expect(refreshSpy).not.toHaveBeenCalled();
  });
});
