import {afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, signal} from '@angular/core';
import {HlmChartImports} from '@spartan-ng/helm/chart';
import type {ChartDefinition, ChartValue} from '@tanstack/charts';

export type AppChartDefinition = ChartDefinition<unknown, ChartValue, ChartValue, 'dom'>;

/** Fits Spartan charts to responsive chart containers. */
@Component({
  selector: 'app-chart',
  imports: [HlmChartImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<tanstack-chart hlmChart [options]="options()" />',
  styles: [':host { display: block; position: relative; min-width: 0; width: 100%; height: 100%; }'],
})
export class ChartComponent {
  readonly definition = input.required<AppChartDefinition>();
  readonly label = input.required<string>();
  private readonly size = signal<{width?: number; height: number}>({height: 320});
  readonly options = computed(() => ({
    definition: this.definition(),
    ariaLabel: this.label(),
    ...this.size(),
  }));

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new ResizeObserver(entries => {
        const bounds = entries[0]?.contentRect;
        if (bounds && bounds.width > 0 && bounds.height > 0) {
          // Layout dimensions exclude the dashboard's entrance scale transform.
          // TanStack's automatic width uses getBoundingClientRect instead.
          this.size.set({width: bounds.width, height: bounds.height});
        }
      });
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
