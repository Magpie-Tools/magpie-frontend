import {HlmTooltip} from '@spartan-ng/helm/tooltip';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-tooltip',
  standalone: true,
  imports: [HlmTooltip],
  templateUrl: './tooltip.component.html',
  styleUrl: './tooltip.component.scss'
})
export class TooltipComponent {
  @Input() text = '';
}
