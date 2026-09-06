export type PageScrollTarget = 'top' | 'bottom';

function readPreference(key: string | null): string | null {
  try {
    return typeof window === 'undefined' || !key ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePreference(key: string | null, value: string): void {
  try {
    if (typeof window !== 'undefined' && key) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Storage can be unavailable or full. Pagination still works without persistence.
  }
}

export function readPageScrollTarget(key: string | null): PageScrollTarget | null {
  const value = readPreference(key);
  return value === 'top' || value === 'bottom' ? value : null;
}

export function writePageScrollTarget(key: string | null, target: PageScrollTarget): void {
  writePreference(key, target);
}

export function readPageSize(key: string | null, allowedSizes: readonly number[]): number | null {
  const value = Number(readPreference(key));
  return Number.isFinite(value) && value > 0 && allowedSizes.includes(value) ? value : null;
}

export function writePageSize(key: string | null, size: number): void {
  if (Number.isFinite(size) && size > 0) {
    writePreference(key, size.toString());
  }
}

export function scrollTableToPageTarget(root: HTMLElement | undefined, target: PageScrollTarget): void {
  if (!root || typeof window === 'undefined') {
    return;
  }

  const innerScroller = root.querySelector<HTMLElement>('.p-datatable-wrapper');
  if (innerScroller && innerScroller.scrollHeight > innerScroller.clientHeight) {
    innerScroller.scrollTo({
      top: target === 'top' ? 0 : innerScroller.scrollHeight,
      behavior: 'auto',
    });
  }

  const scrollContainer = getScrollContainer(root);
  if (!scrollContainer) {
    window.scrollTo({
      top: target === 'top'
        ? root.getBoundingClientRect().top + window.scrollY
        : root.getBoundingClientRect().bottom + window.scrollY - window.innerHeight,
      left: 0,
      behavior: 'auto',
    });
    return;
  }

  const rootRect = root.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  const currentTop = scrollContainer.scrollTop;
  const targetTop = target === 'top'
    ? currentTop + rootRect.top - containerRect.top
    : currentTop + rootRect.bottom - containerRect.bottom;

  scrollContainer.scrollTo({
    top: Math.max(0, targetTop),
    behavior: 'auto',
  });
}

function getScrollContainer(start: HTMLElement): HTMLElement | null {
  let parent = start.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    const canScroll = /(auto|scroll)/.test(overflowY) && parent.scrollHeight > parent.clientHeight;
    if (canScroll) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}
