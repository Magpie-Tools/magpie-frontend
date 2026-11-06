import {CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup} from '@angular/cdk/drag-drop';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {ColumnPickerItem, ColumnPickerPanelComponent} from './column-picker-panel.component';

const columns: ColumnPickerItem[] = [
  {id: 'host', label: 'Host'},
  {id: 'tags', label: 'Tags', required: true},
  {id: 'country', label: 'Country'},
  {id: 'latency', label: 'Latency'},
];

describe('ColumnPickerPanelComponent drag and drop', () => {
  let fixture: ComponentFixture<ColumnPickerPanelComponent>;
  let component: ColumnPickerPanelComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(ColumnPickerPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('selectedColumnIds', ['host', 'tags']);
    fixture.componentRef.setInput('defaultColumnIds', ['host', 'tags']);
    fixture.detectChanges();
  });

  function lists(): CdkDropList<ColumnPickerItem[]>[] {
    return fixture.debugElement.queryAll(By.directive(CdkDropList))
      .map(element => element.injector.get(CdkDropList));
  }

  function drag(id: string): CdkDrag<ColumnPickerItem> {
    return fixture.debugElement.queryAll(By.directive(CdkDrag))
      .map(element => element.injector.get<CdkDrag<ColumnPickerItem>>(CdkDrag))
      .find(item => item.data.id === id)!;
  }

  function drop(id: string, source: number, target: number, currentIndex: number, overContainer = true): void {
    const containers = lists();
    const event: CdkDragDrop<ColumnPickerItem[], ColumnPickerItem[], ColumnPickerItem> = {
      previousIndex: containers[source].data.findIndex(column => column.id === id),
      currentIndex,
      item: drag(id),
      previousContainer: containers[source],
      container: containers[target],
      isPointerOverContainer: overContainer,
      distance: {x: 100, y: 0},
      dropPoint: {x: 100, y: 100},
      event: new MouseEvent('mouseup'),
    };
    component.onColumnDrop(event, target === 0 ? 'visible' : 'hidden');
    fixture.detectChanges();
  }

  it('connects both lists and lets hidden columns be dragged', () => {
    const group = fixture.debugElement.query(By.directive(CdkDropListGroup))
      .injector.get(CdkDropListGroup);
    expect(lists().length).toBe(2);
    expect(fixture.debugElement.queryAll(By.directive(CdkDropList))
      .every(element => element.injector.get(CdkDropListGroup) === group)).toBeTrue();
    expect(drag('country').dropContainer).toBe(lists()[1]);
    expect(lists()[1].sortingDisabled).toBeTrue();
  });

  it('hides a visible column even when source and target indexes match', () => {
    drop('host', 0, 1, 0);
    expect(component.editorColumns()).toEqual(['tags']);
    expect(component.hiddenColumnsFiltered().map(column => column.id)).toEqual(['host', 'country', 'latency']);
  });

  it('inserts a hidden column at the drop position and saves that order', () => {
    drop('country', 1, 0, 0);
    expect(component.editorColumns()).toEqual(['country', 'host', 'tags']);
    const saved = jasmine.createSpy('save');
    component.save.subscribe(saved);
    component.saveChanges();
    expect(saved).toHaveBeenCalledOnceWith(['country', 'host', 'tags']);
  });

  it('reorders visible columns and leaves hidden ordering unchanged', () => {
    drop('host', 0, 0, 1);
    expect(component.editorColumns()).toEqual(['tags', 'host']);
    drop('country', 1, 1, 1);
    expect(component.hiddenColumnsFiltered().map(column => column.id)).toEqual(['country', 'latency']);
  });

  it('rejects required columns in the hidden list without preventing visible reordering', () => {
    expect(component.canDropInHidden(drag('tags'))).toBeFalse();
    drop('tags', 0, 1, 0);
    expect(component.editorColumns()).toEqual(['host', 'tags']);
    drop('tags', 0, 0, 0);
    expect(component.editorColumns()).toEqual(['tags', 'host']);
  });

  it('keeps the last visible column when no columns are required', () => {
    fixture.componentRef.setInput('columns', columns.filter(column => !column.required));
    fixture.componentRef.setInput('selectedColumnIds', ['host']);
    fixture.detectChanges();
    expect(component.canDropInHidden(drag('host'))).toBeFalse();
    drop('host', 0, 1, 0);
    expect(component.editorColumns()).toEqual(['host']);
  });

  it('ignores drops outside either list', () => {
    drop('host', 0, 1, 0, false);
    drop('country', 1, 0, 0, false);
    expect(component.editorColumns()).toEqual(['host', 'tags']);
  });

  it('disables dragging and ignores drops while search is active', () => {
    component.onSearchChange('Host');
    fixture.detectChanges();
    expect(drag('host').disabled).toBeTrue();
    drop('host', 0, 1, 0);
    expect(component.editorColumns()).toEqual(['host', 'tags']);
    component.onSearchChange('Country');
    fixture.detectChanges();
    expect(drag('country').disabled).toBeTrue();
    drop('country', 1, 0, 0);
    expect(component.editorColumns()).toEqual(['host', 'tags']);
  });
});
