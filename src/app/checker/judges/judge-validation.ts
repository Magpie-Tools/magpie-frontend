import {AbstractControl, ValidationErrors, ValidatorFn} from '@angular/forms';

export type JudgeScheme = 'http' | 'https';
export type JudgeCheckMode = 'default' | 'regex';

/** The URL scheme decides which proxy protocols the checker sends to a judge. */
export function judgeScheme(url: string): JudgeScheme | null {
  const value = url.trim().toLowerCase();
  if (value.startsWith('https://')) {
    return 'https';
  }
  return value.startsWith('http://') ? 'http' : null;
}

export function judgeUrlError(url: string): string | null {
  const value = url.trim();
  if (!value) {
    return 'Enter the judge URL.';
  }
  if (!judgeScheme(value)) {
    return 'Start the URL with http:// or https://.';
  }
  try {
    new URL(value);
    return null;
  } catch {
    return 'This is not a valid URL.';
  }
}

/**
 * The checker compiles patterns with Go's regexp package (RE2). It has no
 * lookarounds or backreferences, and it accepts inline flags and (?P<name>)
 * groups that JavaScript rejects, so translate those before the syntax check.
 */
export function judgeRegexError(pattern: string): string | null {
  const value = pattern.trim();
  if (!value) {
    return 'Enter a pattern.';
  }
  if (/\(\?<?[=!]/.test(value) || /\\[1-9]/.test(value)) {
    return 'The checker does not support lookahead, lookbehind or backreferences.';
  }
  const asJavaScript = value
    .replace(/\(\?[imsU]+\)/g, '')
    .replace(/\(\?[imsU-]+:/g, '(?:')
    .replace(/\(\?P</g, '(?<');
  try {
    new RegExp(asJavaScript);
    return null;
  } catch (error) {
    const detail = error instanceof Error ? error.message.replace(/^Invalid regular expression: /, '') : '';
    return detail ? `The pattern does not compile: ${detail}` : 'The pattern does not compile.';
  }
}

export const judgeUrlValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const message = judgeUrlError(String(control.value ?? ''));
  return message ? {judgeUrl: message} : null;
};

/** Requires a usable pattern only while the judge uses a regex check. */
export const judgeRegexValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  if (group.get('mode')?.value !== 'regex') {
    return null;
  }
  const message = judgeRegexError(String(group.get('regex')?.value ?? ''));
  return message ? {judgeRegex: message} : null;
};
