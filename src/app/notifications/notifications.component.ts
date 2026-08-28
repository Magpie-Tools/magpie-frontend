import { CommonModule, DatePipe } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { marked } from 'marked';
import { BuildInfo, ReleaseNote, UpdateNotificationService } from '../services/update-notification.service';
import { LoadingComponent } from '../ui-elements/loading/loading.component';

gsap.registerPlugin(ScrollTrigger);

const RELEASE_SECTION_HEADINGS = new Set([
  "what's changed",
  'whats changed',
  'added',
  'improved',
  'fixed',
  'changed',
  'removed',
  'security',
  'breaking changes',
  'notes'
]);

function looksLikeMarkdown(body: string): boolean {
  return /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|```|> )/.test(body) || /\[[^\]]+\]\([^)]+\)/.test(body);
}

function normalizeReleaseBodyToMarkdown(body: string): string {
  const normalized = body.replace(/\r\n/g, '\n').trim();
  if (!normalized || looksLikeMarkdown(normalized)) {
    return normalized;
  }

  const lines = normalized.split('\n').map((line) => line.trimRight());
  const output: string[] = [];
  let inListSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      output.push('');
      inListSection = false;
      continue;
    }

    const lower = line.toLowerCase();
    if (RELEASE_SECTION_HEADINGS.has(lower)) {
      output.push(`${lower === "what's changed" || lower === 'whats changed' ? '##' : '###'} ${line}`);
      inListSection = lower !== "what's changed" && lower !== 'whats changed';
      continue;
    }

    if (inListSection) {
      output.push(`- ${line}`);
      continue;
    }

    output.push(line);
  }

  return output.join('\n');
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, DatePipe, LoadingComponent, DialogModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent implements OnInit, AfterViewInit, OnDestroy {
  status = signal<{ loading: boolean; error?: string | null }>({ loading: true, error: null });
  newReleases = signal<ReleaseNote[]>([]);
  allReleases = signal<ReleaseNote[]>([]);
  lastSeenTag = signal<string | null>(null);
  latestTag = signal<string | null>(null);
  backendBuild = signal<BuildInfo | null>(null);
  selectedRelease = signal<ReleaseNote | null>(null);
  releaseDialogVisible = signal(false);
  readonly hasNewReleases = computed(() => this.newReleases().length > 0);
  readonly newReleaseCount = computed(() => this.newReleases().length);
  readonly totalReleaseCount = computed(() => this.allReleases().length);
  readonly buildVersionLabel = computed(() => this.backendBuild()?.buildVersion || 'dev');
  readonly archiveCountLabel = computed(() => {
    const count = this.totalReleaseCount();
    return `${count} release${count === 1 ? '' : 's'} in archive`;
  });
  readonly buildTimestamp = computed<Date | null>(() => {
    const builtAt = this.backendBuild()?.builtAt;
    if (!builtAt || builtAt === 'unknown') {
      return null;
    }

    const parsed = new Date(builtAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  });
  readonly selectedReleaseMarkdown = computed(() => {
    const release = this.selectedRelease();
    const body = normalizeReleaseBodyToMarkdown(release?.body?.trim() || 'No changelog text provided.');
    return marked.parse(body, {
      async: false,
      breaks: true,
      gfm: true
    }) as string;
  });
  private shellAnimationContext?: gsap.Context;
  private contentAnimationContext?: gsap.Context;

  constructor(
    private updates: UpdateNotificationService,
    private elementRef: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    this.loadReleases();
  }

  ngAfterViewInit(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    this.shellAnimationContext = gsap.context(() => {
      gsap.fromTo(
        '.notifications-context',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out', clearProps: 'transform' }
      );
    }, this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.shellAnimationContext?.revert();
    this.contentAnimationContext?.revert();
  }

  markAllSeen(): void {
    const latest = this.latestTag();
    if (!latest) {
      return;
    }

    this.updates.markAllSeen(latest);
    this.lastSeenTag.set(latest);
    this.newReleases.set([]);
  }

  retry(): void {
    this.loadReleases();
  }

  openReleaseDialog(release: ReleaseNote): void {
    this.selectedRelease.set(release);
    this.releaseDialogVisible.set(true);
  }

  onReleaseDialogVisibleChange(visible: boolean): void {
    this.releaseDialogVisible.set(visible);
    if (!visible) {
      this.selectedRelease.set(null);
    }
  }

  private loadReleases(): void {
    this.status.set({ loading: true, error: null });

    this.updates.fetchReleaseFeed().subscribe({
      next: (feed) => {
        this.newReleases.set(feed.newSinceLastSeen);
        this.allReleases.set(feed.releases);
        this.lastSeenTag.set(feed.lastSeenTag);
        this.latestTag.set(feed.latestTag);
        this.backendBuild.set(feed.backendBuild);
        this.status.set({ loading: false, error: null });
        this.scheduleContentAnimation();
      },
      error: (err: Error) => {
        this.status.set({
          loading: false,
          error: err?.message ?? 'Failed to load release notes'
        });
      }
    });
  }

  private scheduleContentAnimation(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    requestAnimationFrame(() => this.animateContent());
  }

  private animateContent(): void {
    this.contentAnimationContext?.revert();

    const host = this.elementRef.nativeElement;
    const scrollContainer = host.closest('main') as HTMLElement | null;
    const scroller = scrollContainer ?? undefined;

    this.contentAnimationContext = gsap.context(() => {
      gsap.fromTo(
        '.notification-card',
        { opacity: 0, y: 26, scale: 0.985 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.7,
          stagger: 0.065,
          ease: 'power3.out',
          clearProps: 'transform'
        }
      );

      gsap.utils.toArray<HTMLElement>('.archive-row').forEach((row) => {
        const preview = row.querySelector<HTMLElement>('.archive-preview');
        if (!preview) {
          return;
        }

        gsap.fromTo(
          preview,
          { opacity: 0.42 },
          {
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: row,
              scroller,
              start: 'top 92%',
              end: 'center 58%',
              scrub: 0.35
            }
          }
        );
      });

      const archiveLayout = host.querySelector<HTMLElement>('.archive-layout');
      const archiveIntro = host.querySelector<HTMLElement>('.archive-intro');
      const archiveList = host.querySelector<HTMLElement>('.archive-list');

      if (
        archiveLayout &&
        archiveIntro &&
        archiveList &&
        window.matchMedia('(min-width: 901px)').matches &&
        archiveList.scrollHeight > archiveIntro.offsetHeight + 180
      ) {
        ScrollTrigger.create({
          trigger: archiveLayout,
          endTrigger: archiveList,
          scroller,
          start: 'top top+=24',
          end: 'bottom bottom-=24',
          pin: archiveIntro,
          pinSpacing: false
        });
      }
    }, host);

    requestAnimationFrame(() => ScrollTrigger.refresh());
  }
}
