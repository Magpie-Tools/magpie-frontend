import {Injectable, signal} from '@angular/core';

/** Lets a detail page name itself in the topbar breadcrumb and document title. */
@Injectable({providedIn: 'root'})
export class BreadcrumbService {
  private readonly detail = signal<string | null>(null);
  readonly detailLabel = this.detail.asReadonly();

  setDetailLabel(label: string | null): void {
    this.detail.set(label);
  }
}
