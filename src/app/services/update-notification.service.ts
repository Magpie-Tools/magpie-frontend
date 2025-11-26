import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReleaseNote {
  id: number;
  tagName: string;
  title: string;
  body: string;
  htmlUrl: string;
  publishedAt: string;
  prerelease: boolean;
}

export interface BuildInfo {
  buildVersion: string;
  builtAt: string;
}

interface ReleasesApiResponse {
  releases: ReleaseNote[];
  build: BuildInfo;
}

export interface ReleaseFeed {
  releases: ReleaseNote[];
  newSinceLastSeen: ReleaseNote[];
  lastSeenTag: string | null;
  latestTag: string | null;
  backendBuild: BuildInfo;
}

const LAST_SEEN_KEY = 'magpie.lastSeenReleaseTag';

// normalizeBuildCommit coerces a build hash/tag to a 7-char lowercase string.
export function normalizeBuildCommit(build: string | null | undefined): string | null {
  if (!build) {
    return null;
  }

  const normalized = build.trim().toLowerCase();
  if (!normalized || normalized === 'dev' || normalized === 'development') {
    return null;
  }

  const match = normalized.match(/^[0-9a-f]{7,40}$/);
  if (!match) {
    return null;
  }

  return normalized.slice(0, 7);
}

// partitionNewReleases returns all releases newer than the given tag (assuming list is newest-first).
export function partitionNewReleases(releases: ReleaseNote[], lastSeenTag: string | null): ReleaseNote[] {
  if (!releases?.length) {
    return [];
  }
  if (!lastSeenTag) {
    return releases;
  }

  const seenIndex = releases.findIndex((r) => r.tagName === lastSeenTag);
  if (seenIndex < 0) {
    return releases;
  }
  if (seenIndex === 0) {
    return [];
  }
  return releases.slice(0, seenIndex);
}

@Injectable({ providedIn: 'root' })
export class UpdateNotificationService {
  private readonly apiUrl = `${environment.apiUrl}/releases`;

  constructor(private http: HttpClient) {}

  fetchReleaseFeed(): Observable<ReleaseFeed> {
    return this.http.get<ReleasesApiResponse>(this.apiUrl).pipe(
      map((response) => {
        const releases = (response?.releases ?? []).slice().sort((a, b) => {
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        });

        const lastSeenTag = this.getLastSeenReleaseTag();
        const newSinceLastSeen = partitionNewReleases(releases, lastSeenTag);
        const latestTag = releases[0]?.tagName ?? null;

        return {
          releases,
          newSinceLastSeen,
          lastSeenTag,
          latestTag,
          backendBuild: response?.build ?? { buildVersion: 'dev', builtAt: 'unknown' }
        };
      })
    );
  }

  markAllSeen(tag: string | null): void {
    if (!tag) {
      return;
    }
    this.setLastSeenReleaseTag(tag);
  }

  private getLastSeenReleaseTag(): string | null {
    try {
      const storage = this.getStorage();
      if (!storage) {
        return null;
      }
      const raw = storage.getItem(LAST_SEEN_KEY);
      return raw && raw.length > 0 ? raw : null;
    } catch {
      return null;
    }
  }

  private setLastSeenReleaseTag(tag: string): void {
    try {
      const storage = this.getStorage();
      if (!storage) {
        return;
      }
      storage.setItem(LAST_SEEN_KEY, tag);
    } catch {
      // ignore persistence errors (private browsing, SSR)
    }
  }

  private getStorage(): Storage | null {
    if (typeof window === 'undefined' || !window?.localStorage) {
      return null;
    }
    return window.localStorage;
  }
}
