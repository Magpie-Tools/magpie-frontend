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
  current_sha?: string;
  current_short_sha?: string;
}

const GIT_SHA_REGEX = /^[0-9a-f]{7}$/;
const STORAGE_KEY = 'magpie_update_baseline_commit';

function normalizeCommit(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const short = trimmed.length > 7 ? trimmed.slice(0, 7) : trimmed;
  return short.toLowerCase();
}

function readStoredBaseline(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeBuildCommit(raw);
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

export function normalizeBuildCommit(raw: unknown): string | null {
  const normalized = normalizeCommit(typeof raw === 'string' ? raw : null);
  return normalized && GIT_SHA_REGEX.test(normalized) ? normalized : null;
}

const STORED_BASELINE = readStoredBaseline();
const BUNDLED_COMMIT = normalizeBuildCommit(RAW_COMMIT);

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
  private readonly enabled = !!this.config.enabled;

  private readonly latestRemote = signal<UpdateInfo | null>(null);
  private readonly serverCommit = signal<string | null>(null);
  private readonly baselineCommit = signal<string | null>(STORED_BASELINE);
  private pollSubscription?: Subscription;

  readonly localCommit = computed(() => BUNDLED_COMMIT ?? this.serverCommit() ?? this.baselineCommit());

  readonly latestRemoteCommit: Signal<UpdateInfo | null> = computed(() => this.latestRemote());

  readonly hasUpdate: Signal<boolean> = computed(() => {
    if (!this.enabled) {
      return false;
    }
    const remote = this.latestRemote();
    if (!remote?.sha) {
      return false;
    }
    const local = BUNDLED_COMMIT ?? this.serverCommit() ?? this.baselineCommit();
    if (!local) {
      return false;
    }
    const candidate = remote.shortSha || normalizeCommit(remote.sha);
    if (!candidate) {
      return false;
    }
    return candidate !== local;
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
          const currentBaseline = this.baselineCommit();
          const serverCommit = this.serverCommit();
          if (!currentBaseline) {
            this.setBaseline(update.shortSha);
          } else if (
            (BUNDLED_COMMIT && update.shortSha === BUNDLED_COMMIT && currentBaseline !== update.shortSha) ||
            (serverCommit && update.shortSha === serverCommit && currentBaseline !== serverCommit)
          ) {
            this.setBaseline(update.shortSha);
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

    const shortSha = normalizeCommit(res.short_sha ?? res.sha);
    if (!shortSha || !GIT_SHA_REGEX.test(shortSha)) {
      return null;
    }

    const serverShort = normalizeBuildCommit(res.current_short_sha ?? res.current_sha);
    this.serverCommit.set(serverShort);

    const info: UpdateInfo = {
      sha: res.sha,
      shortSha,
      htmlUrl: res.html_url ?? this.repoUrl,
      message: res.message ?? undefined,
      committedAt: res.committed_at ?? undefined,
    };

    const currentBaseline = this.baselineCommit();
    if (!currentBaseline) {
      this.setBaseline(info.shortSha);
    } else if (
      (BUNDLED_COMMIT && info.shortSha === BUNDLED_COMMIT && currentBaseline !== info.shortSha) ||
      (serverShort && info.shortSha === serverShort && currentBaseline !== serverShort)
    ) {
      this.setBaseline(info.shortSha);
    }

    return info;
  }

  private setBaseline(sha: string) {
    const normalized = normalizeBuildCommit(sha);
    if (!normalized) {
      return;
    }
    this.baselineCommit.set(normalized);
    persistBaseline(normalized);
  }
}
