import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddProxiesComponent } from './add-proxies.component';

describe('AddProxiesComponent', () => {
  let component: AddProxiesComponent;
  let fixture: ComponentFixture<AddProxiesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddProxiesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddProxiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
