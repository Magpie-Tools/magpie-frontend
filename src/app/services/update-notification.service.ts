import {Injectable, Signal, computed, inject, signal} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {Observable, Subscription, catchError, interval, map, of, startWith, switchMap} from 'rxjs';

interface GitHubCommitResponse {
  sha: string;
  html_url?: string;
  commit?: {
    message?: string;
    author?: { date?: string };
    committer?: { date?: string };
  };
}

interface UpdateInfo {
  sha: string;
  shortSha: string;
  htmlUrl?: string;
  message?: string;
  committedAt?: string;
}

const LOCAL_COMMIT =
  (typeof window !== 'undefined' && (window as any).NG_APP_BUILD_SHA) ??
  (import.meta as any)?.env?.NG_APP_BUILD_SHA ??
  'unknown';

@Injectable({ providedIn: 'root' })
export class UpdateNotificationService {
  private readonly http = inject(HttpClient);
  private readonly config = environment.githubUpdates ?? {
    enabled: false,
    owner: '',
    repo: '',
    branch: 'master',
    pollIntervalMs: 300000,
  };
  private readonly pollIntervalMs = this.config.pollIntervalMs ?? 300000;
  private readonly branch = this.config.branch ?? 'master';
  private readonly owner = this.config.owner;
  private readonly repo = this.config.repo;
  private readonly enabled = this.config.enabled && !!this.owner && !!this.repo;

  private readonly latestRemote = signal<UpdateInfo | null>(null);
  private pollSubscription?: Subscription;

  readonly localCommit: string = LOCAL_COMMIT;

  readonly latestRemoteCommit: Signal<UpdateInfo | null> = computed(() => this.latestRemote());

  readonly hasUpdate: Signal<boolean> = computed(() => {
    if (!this.enabled) {
      return false;
    }
    const remote = this.latestRemote();
    if (!remote?.sha) {
      return false;
    }
    if (!this.localCommit || this.localCommit === 'unknown') {
      return false;
    }
    return remote.sha !== this.localCommit;
  });

  start() {
    if (!this.enabled || this.pollSubscription || typeof window === 'undefined') {
      return;
    }

    this.pollSubscription = interval(this.pollIntervalMs)
      .pipe(
        startWith(0),
        switchMap(() => this.fetchLatestCommit())
      )
      .subscribe(update => {
        if (update) {
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
    return `https://github.com/${this.owner}/${this.repo}`;
  }

  private fetchLatestCommit(): Observable<UpdateInfo | null> {
    const endpoint = `https://api.github.com/repos/${this.owner}/${this.repo}/commits/${this.branch}`;
    const headers = new HttpHeaders({
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'magpie-update-checker'
    });

    return this.http
      .get<GitHubCommitResponse>(endpoint, { headers })
      .pipe(
        catchError(() => of(null)),
        map(res => this.mapResponse(res))
      );
  }

  private mapResponse(res: GitHubCommitResponse | null): UpdateInfo | null {
    if (!res?.sha) {
      return null;
    }
    const htmlUrl = res.html_url ?? this.repoUrl;
    const message = res.commit?.message?.split('\n')[0];
    const committedAt =
      res.commit?.author?.date ??
      res.commit?.committer?.date ??
      undefined;

    return {
      sha: res.sha,
      shortSha: res.sha.slice(0, 7),
      htmlUrl,
      message,
      committedAt,
    };
  }
}
