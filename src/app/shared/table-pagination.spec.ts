import {readPageScrollTarget, readPageSize, scrollTableToPageTarget, writePageScrollTarget, writePageSize} from './table-pagination';

describe('table pagination', () => {
  const key = 'magpie-pagination-test';
  afterEach(() => localStorage.removeItem(key));

  it('restores only supported page sizes and scroll targets', () => {
    for (const value of ['garbage', '-1', '0', '41', 'Infinity']) {
      localStorage.setItem(key, value);
      expect(readPageSize(key, [20, 40])).toBeNull();
      expect(readPageScrollTarget(key)).toBeNull();
    }
    writePageSize(key, 40);
    expect(readPageSize(key, [20, 40])).toBe(40);
    writePageScrollTarget(key, 'bottom');
    expect(readPageScrollTarget(key)).toBe('bottom');
    expect(readPageScrollTarget(null)).toBeNull();
  });

  it('keeps pagination usable when storage throws', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('Storage blocked');
    spyOn(Storage.prototype, 'setItem').and.throwError('Storage full');
    expect(readPageSize(key, [40])).toBeNull();
    expect(readPageScrollTarget(key)).toBeNull();
    expect(() => writePageSize(key, 40)).not.toThrow();
    expect(() => writePageScrollTarget(key, 'top')).not.toThrow();
  });

  it('aligns the table within the nearest scrollable parent', () => {
    const parent = document.createElement('div');
    const root = document.createElement('div');
    const inner = document.createElement('div');
    inner.className = 'table-scroll';
    root.append(inner);
    parent.append(root);
    document.body.append(parent);
    parent.style.overflowY = 'auto';
    Object.defineProperties(parent, {scrollHeight: {value: 1000}, clientHeight: {value: 200}});
    Object.defineProperties(inner, {scrollHeight: {value: 500}, clientHeight: {value: 100}});
    spyOn(parent, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 100, 200, 200));
    spyOn(root, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 150, 200, 400));
    const scrollParent = spyOn(parent, 'scrollTo') as jasmine.Spy<(options: ScrollToOptions) => void>;
    const scrollInner = spyOn(inner, 'scrollTo') as jasmine.Spy<(options: ScrollToOptions) => void>;
    try {
      scrollTableToPageTarget(root, 'bottom');
      expect(scrollInner).toHaveBeenCalledWith({top: 500, behavior: 'auto'});
      expect(scrollParent).toHaveBeenCalledWith({top: 250, behavior: 'auto'});
      scrollTableToPageTarget(root, 'top');
      expect(scrollInner).toHaveBeenCalledWith({top: 0, behavior: 'auto'});
      expect(scrollParent).toHaveBeenCalledWith({top: 50, behavior: 'auto'});
    } finally {
      parent.remove();
    }
  });
});
