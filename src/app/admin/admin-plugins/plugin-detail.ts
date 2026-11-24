import {AbstractControl, FormGroup} from '@angular/forms';

export type PluginStateTone = 'off' | 'good' | 'bad';

export interface PluginState {
  tone: PluginStateTone;
  label: string;
}

/** "1 unsaved change: report max age" for the save dock, from the dirty controls it can name. */
export function unsavedSummary(form: FormGroup, labels: Record<string, string>): string {
  const names = Object.entries(labels)
    .filter(([path]) => form.get(path)?.dirty)
    .map(([, label]) => label);
  const unique = [...new Set(names)];
  if (!unique.length) {
    return 'Unsaved changes';
  }
  const count = `${unique.length} unsaved ${unique.length === 1 ? 'change' : 'changes'}`;
  return `${count}: ${unique.join(', ')}`;
}

/** Share of a daily allowance that is used up, as a whole percentage from 0 to 100. */
export function usedPercent(used: number, limit: number): number {
  if (!limit || limit <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(used / limit * 100)));
}

export function hasText(control: AbstractControl | null): boolean {
  const value = control?.value;
  return typeof value === 'string' && value.trim().length > 0;
}
