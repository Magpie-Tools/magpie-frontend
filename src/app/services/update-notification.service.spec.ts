import {normalizeBuildCommit, partitionNewReleases, ReleaseNote} from './update-notification.service';

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

describe('partitionNewReleases', () => {
  const releases: ReleaseNote[] = [
    { id: 1, tagName: 'v2.0.0', title: 'Latest', body: '', htmlUrl: '', publishedAt: '2024-02-01T00:00:00Z', prerelease: false },
    { id: 2, tagName: 'v1.5.0', title: 'Middle', body: '', htmlUrl: '', publishedAt: '2024-01-15T00:00:00Z', prerelease: false },
    { id: 3, tagName: 'v1.0.0', title: 'Old', body: '', htmlUrl: '', publishedAt: '2024-01-01T00:00:00Z', prerelease: false },
  ];

  it('returns all releases when no last seen tag is stored', () => {
    expect(partitionNewReleases(releases, null).map(r => r.tagName)).toEqual(['v2.0.0', 'v1.5.0', 'v1.0.0']);
  });

  it('returns nothing when the latest tag was already seen', () => {
    expect(partitionNewReleases(releases, 'v2.0.0')).toEqual([]);
  });

  it('returns only entries newer than the last seen tag', () => {
    expect(partitionNewReleases(releases, 'v1.5.0').map(r => r.tagName)).toEqual(['v2.0.0']);
  });

  it('treats unknown tags as unseen (returns everything)', () => {
    expect(partitionNewReleases(releases, 'v0.9.0').length).toBe(3);
  });
});
