import {Injectable, Signal, computed, inject, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {Observable, Subscription, catchError, interval, of, startWith, switchMap} from 'rxjs';

interface VersionResponse {
  version?: string;
  built_at?: string;
}

@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly http = inject(HttpClient);
  private readonly currentVersion = signal<string | null>(null);
  private readonly latestKnownVersion = signal<string | null>(null);
  private pollSub?: Subscription;
  private readonly pollIntervalMs = 60000;

  readonly hasUpdate: Signal<boolean> = computed(() => {
    const current = this.currentVersion();
    const latest = this.latestKnownVersion();
    return Boolean(current && latest && current !== latest);
  });

  readonly availableVersion: Signal<string | null> = computed(() => this.latestKnownVersion());

  start() {
    if (this.pollSub || typeof window === 'undefined') {
      return;
    }

    this.pollSub = interval(this.pollIntervalMs)
      .pipe(
        startWith(0),
        switchMap(() => this.fetchVersion())
      )
      .subscribe(response => {
        if (!response?.version) {
          return;
        }

        const version = response.version.trim();
        if (!version) {
          return;
        }

        if (!this.currentVersion()) {
          this.currentVersion.set(version);
        }

        this.latestKnownVersion.set(version);
      });
  }

  acknowledgeUpdate() {
    this.currentVersion.set(this.latestKnownVersion());
  }

  private fetchVersion(): Observable<VersionResponse | null> {
    return this.http
      .get<VersionResponse>(`${environment.apiUrl}/version`, {
        params: { _: Date.now().toString() },
      })
      .pipe(
        catchError(() => of(null))
      );
  }
}
