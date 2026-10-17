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
  latestTag: string | null;
  backendBuild: BuildInfo;
}

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

        const latestTag = releases[0]?.tagName ?? null;

        return {
          releases,
          latestTag,
          backendBuild: response?.build ?? { buildVersion: 'dev', builtAt: 'unknown' }
        };
      })
    );
  }

}
