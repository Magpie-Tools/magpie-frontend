import {DestroyRef, inject, Injectable, signal} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {finalize} from 'rxjs';
import {environment} from '../../environments/environment';
import {NotificationService} from './notification-service.service';

// Provided by the authenticated shell so a new account starts with fresh state.
@Injectable()
export class NotificationReadService {
  readonly loading = signal(false);
  readonly error = signal(false);
  private readonly readIds = signal<ReadonlySet<string>>(new Set());
  private readonly knownIds = signal<ReadonlySet<string>>(new Set());
  private readonly pendingIds = signal<ReadonlySet<string>>(new Set());
  private readonly destroyRef = inject(DestroyRef);
  private readonly url = `${environment.apiUrl}/notifications`;
  private readonly activeLoads = new Set<string>();

  constructor(private readonly http: HttpClient, private readonly notifications: NotificationService) {}

  isUnread(id: string): boolean {
    return this.knownIds().has(id) && !this.isRead(id);
  }

  isRead(id: string): boolean {
    return this.readIds().has(id) || this.pendingIds().has(id);
  }

  hasStatus(id: string): boolean {
    return this.knownIds().has(id) || this.isRead(id);
  }

  load(ids: readonly string[]): void {
    const unique = [...new Set(ids)];
    for (let offset = 0; offset < unique.length; offset += 50) {
      this.loadBatch(unique.slice(offset, offset + 50));
    }
  }

  private loadBatch(ids: readonly string[]): void {
    const key = [...ids].sort().join(',');
    if (this.activeLoads.has(key)) return;
    this.activeLoads.add(key);
    this.error.set(false);
    this.loading.set(true);
    const params = new HttpParams().set('ids', ids.join(','));
    this.http.get<{read_ids: string[]}>(`${this.url}/read-state`, {params}).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.activeLoads.delete(key);
        this.loading.set(this.activeLoads.size > 0);
      }),
    ).subscribe({
      next: response => {
        this.knownIds.update(known => new Set([...known, ...ids]));
        // Reads are permanent. A response started before a click must not undo
        // a receipt that has since been saved by this browser.
        this.readIds.update(read => new Set([...read, ...response.read_ids]));
      },
      error: () => this.error.set(true),
    });
  }

  markRead(id: string): void {
    if (this.readIds().has(id) || this.pendingIds().has(id)) return;
    this.pendingIds.update(pending => new Set([...pending, id]));
    this.http.put<void>(`${this.url}/${encodeURIComponent(id)}/read`, {}).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.pendingIds.update(pending => {
        const remaining = new Set(pending);
        remaining.delete(id);
        return remaining;
      })),
    ).subscribe({
      next: () => this.readIds.update(read => new Set([...read, id])),
      error: () => this.notifications.showError('Could not mark notification as read. Please try again.'),
    });
  }
}
