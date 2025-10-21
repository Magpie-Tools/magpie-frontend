import {normalizeBuildCommit} from './update-notification.service';

describe('normalizeBuildCommit', () => {
  it('ignores placeholder build shas', () => {
    expect(normalizeBuildCommit('dev')).toBeNull();
    expect(normalizeBuildCommit('development')).toBeNull();
    expect(normalizeBuildCommit('')).toBeNull();
    expect(normalizeBuildCommit(null)).toBeNull();
  });

  it('normalizes valid commit hashes to seven lowercase characters', () => {
    expect(normalizeBuildCommit('ABCDEF1234567890')).toBe('abcdef1');
    expect(normalizeBuildCommit('1234567')).toBe('1234567');
    expect(normalizeBuildCommit('1234567890abcdef1234567890abcdef12345678')).toBe('1234567');
  });
});
