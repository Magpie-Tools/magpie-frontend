import {Injectable, Signal, computed, inject, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {Observable, Subscription, catchError, interval, map, of, startWith, switchMap} from 'rxjs';

interface UpdateInfo {
  sha: string;
  shortSha: string;
  htmlUrl?: string;
  message?: string;
  committedAt?: string;
}

interface BackendUpdateResponse {
  sha?: string;
  short_sha?: string;
  html_url?: string;
  message?: string;
  committed_at?: string;
}

const STORAGE_KEY = 'magpie_update_baseline_commit';

function readStoredBaseline(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw && raw.trim().length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function persistBaseline(commit: string) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, commit);
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

const RAW_COMMIT =
  (typeof window !== 'undefined' && (window as any).NG_APP_BUILD_SHA) ??
  (import.meta as any)?.env?.NG_APP_BUILD_SHA ??
  '';

const STORED_BASELINE = readStoredBaseline();

const INITIAL_COMMIT =
  typeof RAW_COMMIT === 'string' && RAW_COMMIT && RAW_COMMIT !== 'dev'
    ? RAW_COMMIT
    : STORED_BASELINE;

@Injectable({ providedIn: 'root' })
export class UpdateNotificationService {
  private readonly http = inject(HttpClient);
  private readonly config = environment.githubUpdates ?? {
    enabled: false,
    owner: '',
    repo: '',
    pollIntervalMs: 300000,
  };
  private readonly pollIntervalMs = this.config.pollIntervalMs ?? 300000;
  private readonly owner = this.config.owner ?? '';
  private readonly repo = this.config.repo ?? '';
  private readonly enabled = this.config.enabled;

  private readonly latestRemote = signal<UpdateInfo | null>(null);
  private readonly baselineCommit = signal<string | null>(INITIAL_COMMIT);
  private pollSubscription?: Subscription;

  readonly localCommit = computed(() => this.baselineCommit());

  readonly latestRemoteCommit: Signal<UpdateInfo | null> = computed(() => this.latestRemote());

  readonly hasUpdate: Signal<boolean> = computed(() => {
    if (!this.enabled) {
      return false;
    }
    const remote = this.latestRemote();
    if (!remote?.sha) {
      return false;
    }
    const baseline = this.baselineCommit();
    if (!baseline) {
      return false;
    }
    return remote.sha !== baseline;
  });

  start() {
    if (!this.enabled || this.pollSubscription || typeof window === 'undefined') {
      return;
    }

    const baseline = this.baselineCommit();
    if (baseline) {
      persistBaseline(baseline);
    }

    this.pollSubscription = interval(this.pollIntervalMs)
      .pipe(
        startWith(0),
        switchMap(() => this.fetchLatestCommit())
      )
      .subscribe(update => {
        if (update) {
          if (!this.baselineCommit()) {
            this.setBaseline(update.sha);
          }
          this.latestRemote.set(update);
        }
      });
  }

  openLatestCommit() {
    if (typeof window === 'undefined') {
      return;
    }
    const url = this.latestRemote()?.htmlUrl ?? this.repoUrl;
    window.open(url, '_blank', 'noopener');
  }

  private get repoUrl(): string {
    if (this.owner && this.repo) {
      return `https://github.com/${this.owner}/${this.repo}`;
    }
    return 'https://github.com';
  }

  private fetchLatestCommit(): Observable<UpdateInfo | null> {
    return this.http
      .get<BackendUpdateResponse>(`${environment.apiUrl}/updates/latest`)
      .pipe(
        catchError(() => of(null)),
        map(res => this.mapResponse(res))
      );
  }

  private mapResponse(res: BackendUpdateResponse | null): UpdateInfo | null {
    if (!res?.sha) {
      return null;
    }
    const htmlUrl = res.html_url ?? this.repoUrl;
    const message = res.message ?? undefined;
    const committedAt = res.committed_at ?? undefined;

    const info: UpdateInfo = {
      sha: res.sha,
      shortSha: (res.short_sha ?? res.sha).slice(0, 7),
      htmlUrl,
      message,
      committedAt,
    };

    if (!this.baselineCommit()) {
      this.setBaseline(info.sha);
    }

    return info;
  }

  private setBaseline(sha: string) {
    this.baselineCommit.set(sha);
    persistBaseline(sha);
  }
}
