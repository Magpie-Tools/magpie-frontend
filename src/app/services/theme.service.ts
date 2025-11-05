import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';

export type ThemeName = 'green' | 'blue' | 'red' | 'purple';

const THEME_STORAGE_KEY = 'magpie.theme';
const THEME_CLASS_PREFIX = 'theme-';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly availableThemes: ThemeName[] = ['green', 'blue', 'red', 'purple'];
  private readonly currentTheme = signal<ThemeName>(this.loadInitialTheme());

  readonly theme = this.currentTheme.asReadonly();
  readonly themes = [...this.availableThemes];

  constructor() {
    effect(() => {
      const nextTheme = this.currentTheme();
      if (!this.isBrowser) {
        return;
      }

      this.applyThemeClass(nextTheme);
      this.persistTheme(nextTheme);
    });
  }

  setTheme(theme: ThemeName): void {
    if (!this.availableThemes.includes(theme)) {
      return;
    }
    this.currentTheme.set(theme);
  }

  private loadInitialTheme(): ThemeName {
    if (!this.isBrowser) {
      return 'green';
    }
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeName | null;
      if (stored && this.availableThemes.includes(stored)) {
        return stored;
      }
    } catch {
      // Ignore storage access issues and fall back to default
    }
    return 'green';
  }

  private applyThemeClass(theme: ThemeName): void {
    const root = this.document.documentElement;
    this.availableThemes.forEach((availableTheme) => {
      const className = `${THEME_CLASS_PREFIX}${availableTheme}`;
      if (availableTheme === theme) {
        root.classList.add(className);
      } else {
        root.classList.remove(className);
      }
    });
  }

  private persistTheme(theme: ThemeName): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // No-op when storage is not accessible (e.g., privacy mode)
    }
  }
}
