import {Component, Input} from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {MatTooltip} from '@angular/material/tooltip';

@Component({
    selector: 'app-tooltip',
    imports: [
        MatIcon,
        MatTooltip
    ],
    templateUrl: './tooltip.component.html',
    styleUrl: './tooltip.component.scss'
})
export class TooltipComponent {
  @Input() text = ''
}
