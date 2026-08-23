import {Injectable, signal} from '@angular/core';
import {Observable, of, shareReplay} from 'rxjs';
import {finalize, tap} from 'rxjs/operators';
import {ProxyTag, ProxyTagWriteRequest} from '../models/ProxyTag';
import {HttpService} from './http.service';

@Injectable({providedIn: 'root'})
export class ProxyTagService {
  private readonly tagState = signal<ProxyTag[]>([]);
  private loaded = false;
  private loadRequest?: Observable<ProxyTag[]>;

  readonly tags = this.tagState.asReadonly();
  readonly loading = signal(false);

  constructor(private http: HttpService) {}

  load(force = false): Observable<ProxyTag[]> {
    if (this.loaded && !force) {
      return of(this.tagState());
    }
    if (this.loadRequest && !force) {
      return this.loadRequest;
    }

    this.loading.set(true);
    const request = this.http.getProxyTags().pipe(
      tap(tags => {
        this.tagState.set(this.sortTags(tags));
        this.loaded = true;
      }),
      finalize(() => {
        this.loading.set(false);
        if (this.loadRequest === request) {
          this.loadRequest = undefined;
        }
      }),
      shareReplay({bufferSize: 1, refCount: false}),
    );
    this.loadRequest = request;
    return request;
  }

  create(payload: ProxyTagWriteRequest): Observable<ProxyTag> {
    return this.http.createProxyTag(payload).pipe(
      tap(tag => this.tagState.set(this.sortTags([...this.tagState(), tag]))),
    );
  }

  update(tagId: number, payload: ProxyTagWriteRequest): Observable<ProxyTag> {
    return this.http.updateProxyTag(tagId, payload).pipe(
      tap(updated => this.tagState.set(this.sortTags(
        this.tagState().map(tag => tag.id === updated.id ? updated : tag),
      ))),
    );
  }

  delete(tagId: number): Observable<void> {
    return this.http.deleteProxyTag(tagId).pipe(
      tap(() => this.tagState.set(this.tagState().filter(tag => tag.id !== tagId))),
    );
  }

  replaceProxyTags(proxyId: number, tagIds: readonly number[]): Observable<ProxyTag[]> {
    return this.http.replaceProxyTags(proxyId, tagIds).pipe(
      tap(tags => {
        const catalog = new Map(this.tagState().map(tag => [tag.id, tag] as const));
        for (const tag of tags) {
          catalog.set(tag.id, tag);
        }
        this.tagState.set(this.sortTags([...catalog.values()]));
      }),
    );
  }

  private sortTags(tags: readonly ProxyTag[]): ProxyTag[] {
    return [...tags].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
  }
}
