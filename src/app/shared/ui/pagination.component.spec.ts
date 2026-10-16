import {ComponentFixture, TestBed} from '@angular/core/testing';
import {PaginationComponent} from './pagination.component';

describe('PaginationComponent', () => {
  let fixture: ComponentFixture<PaginationComponent>;
  let pageChange: jasmine.Spy;
  const storageKey = 'magpie-pagination-controls-test';

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [PaginationComponent]}).compileComponents();
    fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentRef.setInput('first', 40);
    fixture.componentRef.setInput('rows', 20);
    fixture.componentRef.setInput('totalRecords', 101);
    fixture.componentRef.setInput('rowsPerPageOptions', [20, 50]);
    fixture.componentRef.setInput('sortField', 'ip');
    fixture.componentRef.setInput('sortOrder', -1);
    pageChange = jasmine.createSpy('pageChange');
    fixture.componentInstance.pageChange.subscribe(pageChange);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => localStorage.removeItem(storageKey));

  function button(label: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`button[aria-label="${label}"]`);
  }

  async function jump(value: string): Promise<void> {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.page-jump__input');
    input.value = value;
    input.dispatchEvent(new Event('input', {bubbles: true}));
    await fixture.whenStable();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', {cancelable: true}));
  }

  it('keeps sorting and row size when navigating with each page button', () => {
    for (const [label, first] of [['First page', 0], ['Previous page', 20], ['Next page', 60], ['Last page', 100]] as const) {
      button(label).click();
      expect(pageChange).toHaveBeenCalledWith({first, rows: 20, sortField: 'ip', sortOrder: -1});
    }
  });

  it('shows the record range and disables navigation at either boundary', () => {
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('41–60 of 101');
    fixture.componentRef.setInput('first', 0);
    fixture.detectChanges();
    expect(button('First page').disabled).toBeTrue();
    expect(button('Previous page').disabled).toBeTrue();
    fixture.componentRef.setInput('first', 100);
    fixture.detectChanges();
    expect(button('Next page').disabled).toBeTrue();
    expect(button('Last page').disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('101–101 of 101');
  });

  for (const [value, first] of [['4.9', 60], ['999', 100], ['-1', 0]] as const) {
    it(`clamps page ${value} and submits the corresponding record offset`, async () => {
      await jump(value);
      expect(pageChange).toHaveBeenCalledOnceWith({first, rows: 20, sortField: 'ip', sortOrder: -1});
    });
  }

  it('does not request the current page or submit a nonfinite page', async () => {
    await jump('3');
    fixture.componentInstance.pageJumpValue = NaN;
    fixture.componentInstance.jump(new Event('submit'));
    expect(pageChange).not.toHaveBeenCalled();
    expect(fixture.componentInstance.pageJumpValue).toBe(3);
  });

  it('updates the page field when the parent changes pages or page size', async () => {
    fixture.componentRef.setInput('first', 60);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.page-jump__input').value).toBe('4');
    fixture.componentRef.setInput('rows', 50);
    fixture.componentRef.setInput('first', 50);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.page-jump__input').value).toBe('2');
  });

  it('blocks page changes while loading and for an empty table', async () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    button('Next page').click();
    await jump('4');
    fixture.componentInstance.resize(50);
    expect(pageChange).not.toHaveBeenCalled();
    fixture.componentRef.setInput('disabled', false);
    fixture.componentRef.setInput('first', 0);
    fixture.componentRef.setInput('totalRecords', 0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.page-jump__input').disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('.page-jump__total').textContent).toBe('of 1');
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('0–0 of 0');
  });

  it('resets to the first page only for supported row sizes', () => {
    fixture.componentInstance.resize('50');
    expect(pageChange).toHaveBeenCalledOnceWith({first: 0, rows: 50, sortField: 'ip', sortOrder: -1});
    fixture.componentInstance.resize(17);
    expect(pageChange).toHaveBeenCalledTimes(1);
  });

  it('restores, announces, and persists each table scroll preference', () => {
    localStorage.setItem(storageKey, 'bottom');
    const scrollChange = jasmine.createSpy('scrollChange');
    fixture.componentInstance.pageScrollTargetChange.subscribe(scrollChange);
    fixture.componentRef.setInput('pageScrollTargetStorageKey', storageKey);
    fixture.detectChanges();
    expect(scrollChange).toHaveBeenCalledOnceWith('bottom');
    const toggle = button('Page changes stay at bottom');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(scrollChange).toHaveBeenCalledWith('top');
    expect(localStorage.getItem(storageKey)).toBe('top');
    expect(button('Page changes scroll to top').getAttribute('aria-pressed')).toBe('true');
  });

  it('gives each paginator unique accessible page field identifiers', () => {
    const other = TestBed.createComponent(PaginationComponent);
    other.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.page-jump__input');
    const otherInput: HTMLInputElement = other.nativeElement.querySelector('.page-jump__input');
    expect(input.id).not.toBe(otherInput.id);
    expect(fixture.nativeElement.querySelector('label.page-jump__label').htmlFor).toBe(input.id);
    expect(input.getAttribute('aria-describedby')).toBe(fixture.nativeElement.querySelector('.page-jump__total').id);
    other.destroy();
  });
});
