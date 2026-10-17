import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {environment} from '../../environments/environment';
import {normalizeBuildCommit, ReleaseNote, UpdateNotificationService} from './update-notification.service';

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

describe('UpdateNotificationService', () => {
  const releases: ReleaseNote[] = [
    { id: 1, tagName: 'v2.0.0', title: 'Latest', body: '', htmlUrl: '', publishedAt: '2024-02-01T00:00:00Z', prerelease: false },
    { id: 2, tagName: 'v1.5.0', title: 'Middle', body: '', htmlUrl: '', publishedAt: '2024-01-15T00:00:00Z', prerelease: false },
    { id: 3, tagName: 'v1.0.0', title: 'Old', body: '', htmlUrl: '', publishedAt: '2024-01-01T00:00:00Z', prerelease: false },
  ];

  it('loads and sorts the full archive without using browser-local read state', () => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(UpdateNotificationService);
    const getStorage = spyOn(Storage.prototype, 'getItem').and.throwError('Browser storage unavailable');
    service.fetchReleaseFeed().subscribe(feed => {
      expect(feed.releases.map(release => release.tagName)).toEqual(['v2.0.0', 'v1.5.0', 'v1.0.0']);
      expect(feed.latestTag).toBe('v2.0.0');
      expect(feed.backendBuild.buildVersion).toBe('dev');
    });
    http.expectOne(`${environment.apiUrl}/releases`).flush({releases: [...releases].reverse()});
    expect(getStorage).not.toHaveBeenCalled();
    http.verify();
  });
});
