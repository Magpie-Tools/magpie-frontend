import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScrapeSourceListComponent } from './scrape-source-list.component';

describe('ScrapeSourceListComponent', () => {
  let component: ScrapeSourceListComponent;
  let fixture: ComponentFixture<ScrapeSourceListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScrapeSourceListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScrapeSourceListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
