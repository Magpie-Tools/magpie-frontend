import {computed, Injectable, signal} from '@angular/core';
import {Observable, of} from 'rxjs';
import {finalize, shareReplay, tap} from 'rxjs/operators';
import {Workspace, WorkspaceRole} from '../models/Workspace';
import {HttpService} from './http.service';

const workspaceStorageKey = 'magpie-workspace-id';

@Injectable({providedIn: 'root'})
export class WorkspaceService {
  readonly workspaces = signal<Workspace[]>([]);
  readonly current = signal<Workspace | null>(null);
  readonly loading = signal(false);
  readonly canOperate = computed(() => this.roleRank(this.current()?.role) >= this.roleRank('operator'));
  readonly canAdminister = computed(() => this.roleRank(this.current()?.role) >= this.roleRank('admin'));
  readonly isOwner = computed(() => this.current()?.role === 'owner');

  private loadRequest?: Observable<Workspace[]>;

  constructor(private readonly http: HttpService) {}

  load(force = false): Observable<Workspace[]> {
    if (!force && this.workspaces().length > 0) {
      return of(this.workspaces());
    }
    if (!force && this.loadRequest) {
      return this.loadRequest;
    }

    this.loading.set(true);
    this.loadRequest = this.http.getWorkspaces().pipe(
      tap(workspaces => {
        this.workspaces.set(workspaces);
        this.setInitialWorkspace(workspaces);
      }),
      finalize(() => {
        this.loading.set(false);
        this.loadRequest = undefined;
      }),
      shareReplay({bufferSize: 1, refCount: false}),
    );
    return this.loadRequest;
  }

  switchTo(workspaceId: number): Observable<void> {
    const workspace = this.workspaces().find(candidate => candidate.id === workspaceId);
    if (!workspace || workspace.id === this.current()?.id) {
      return of(undefined);
    }

    return this.http.selectWorkspace(workspace.id).pipe(
      tap(() => {
        this.persistWorkspaceId(workspace.id);
        this.current.set(workspace);
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }),
    );
  }

  refresh(): Observable<Workspace[]> {
    return this.load(true);
  }

  updateCachedWorkspace(updated: Workspace): void {
    this.workspaces.update(workspaces => workspaces.map(workspace => workspace.id === updated.id ? updated : workspace));
    if (this.current()?.id === updated.id) {
      this.current.set(updated);
    }
  }

  capacityLabel(workspace = this.current()): string {
    if (!workspace) {
      return '';
    }
    const active = workspace.capacity.active_routes.toLocaleString();
    const limit = workspace.capacity.activation_limit;
    return limit === null
      ? `${active} active routes`
      : `${active} of ${limit.toLocaleString()} active routes`;
  }

  private setInitialWorkspace(workspaces: Workspace[]): void {
    if (workspaces.length === 0) {
      this.current.set(null);
      this.clearWorkspaceId();
      return;
    }

    const storedId = this.readWorkspaceId();
    const selected = workspaces.find(workspace => workspace.id === storedId)
      ?? workspaces.find(workspace => workspace.is_default)
      ?? workspaces[0];
    this.current.set(selected);
    this.persistWorkspaceId(selected.id);
  }

  private roleRank(role?: WorkspaceRole): number {
    switch (role) {
      case 'owner': return 4;
      case 'admin': return 3;
      case 'operator': return 2;
      case 'viewer': return 1;
      default: return 0;
    }
  }

  private readWorkspaceId(): number | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const parsed = Number(window.localStorage.getItem(workspaceStorageKey));
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private persistWorkspaceId(workspaceId: number): void {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(workspaceStorageKey, workspaceId.toString());
    }
  }

  private clearWorkspaceId(): void {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(workspaceStorageKey);
    }
  }
}
