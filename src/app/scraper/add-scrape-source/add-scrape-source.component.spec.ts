import { ComponentFixture, TestBed } from '@angular/core/testing';
import {of} from 'rxjs';
import {HttpService} from '../../services/http.service';
import { MessageService } from 'primeng/api';
import { AddScrapeSourceComponent } from './add-scrape-source.component';

describe('AddScrapeSourceComponent', () => {
  let upload: jasmine.Spy;
  let component: AddScrapeSourceComponent;
  let fixture: ComponentFixture<AddScrapeSourceComponent>;

  beforeEach(async () => {
    upload = jasmine.createSpy('uploadScrapeSources').and.returnValue(of({sourceCount: 1}));
    await TestBed.configureTestingModule({
      imports: [AddScrapeSourceComponent],
      providers: [MessageService, {provide: HttpService, useValue: {uploadScrapeSources: upload}}]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddScrapeSourceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('defaults to HTTP and explicitly submits browser mode when JavaScript is enabled', () => {
    component.scrapeSourceTextarea.set('https://example.com/list');
    component.submitScrapeSources();
    expect((upload.calls.mostRecent().args[0] as FormData).get('fetch_mode')).toBe('http');
    component.scrapeSourceTextarea.set('https://example.com/dynamic');
    component.requiresJavaScript.set(true);
    component.submitScrapeSources();
    expect((upload.calls.mostRecent().args[0] as FormData).get('fetch_mode')).toBe('browser');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
