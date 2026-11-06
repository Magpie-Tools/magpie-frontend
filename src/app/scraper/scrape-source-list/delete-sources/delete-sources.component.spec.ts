import {ComponentFixture, TestBed} from '@angular/core/testing';

import {of} from 'rxjs';
import {DeleteSourcesComponent} from './delete-sources.component';
import {HttpService} from '../../../services/http.service';
import {NotificationService} from '../../../services/notification-service.service';

describe('DeleteSourcesComponent', () => {
  let component: DeleteSourcesComponent;
  let fixture: ComponentFixture<DeleteSourcesComponent>;
  let deleteScrapingSourceSpy: jasmine.Spy;

  beforeEach(async () => {
    deleteScrapingSourceSpy = jasmine.createSpy('deleteScrapingSource').and.returnValue(of('Deleted 1 scraping sources.'));

    await TestBed.configureTestingModule({
      imports: [DeleteSourcesComponent],
      providers: [
        {provide: HttpService, useValue: {deleteScrapingSource: deleteScrapingSourceSpy}},
        {provide: NotificationService, useValue: {showError: jasmine.createSpy('showError'), showInfo: jasmine.createSpy('showInfo'), showSuccess: jasmine.createSpy('showSuccess')}},
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteSourcesComponent);
    component = fixture.componentInstance;
    component.allSources = [{id: 1} as never];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens without a preselected scope when nothing is selected', () => {
    component.openDialog();

    expect(component.deleteOption).toBeNull();
    expect(component.actionLabel).toBe('Choose what to delete');
  });

  it('asks for an acknowledgement before deleting every source', () => {
    component.deleteOption = 'all';

    expect(component.confirmLabel).toContain('every source in this workspace');
    component.deleteForm.patchValue({filter: true});
    expect(component.confirmLabel).toContain('matching these filters');
    expect(component.actionLabel).toBe('Delete matching sources');
  });

  it('does not delete before a scope is chosen', () => {
    component.openDialog();
    component.submitDelete();

    expect(deleteScrapingSourceSpy).not.toHaveBeenCalled();
  });

  it('deletes all sources with count filters', () => {
    component.deleteOption = 'all';
    component.deleteForm.patchValue({
      filter: true,
      proxyCountOperator: '<',
      proxyCount: 25,
      aliveCountOperator: '>',
      aliveCount: 10,
    });

    component.submitDelete();

    expect(deleteScrapingSourceSpy).toHaveBeenCalledWith(jasmine.objectContaining({
      scope: 'all',
      filter: true,
      proxyCountOperator: '<',
      proxyCount: 25,
      aliveCountOperator: '>',
      aliveCount: 10,
    }));
  });
});
