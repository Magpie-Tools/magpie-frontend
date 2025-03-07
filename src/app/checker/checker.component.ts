import {Component} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatIcon} from '@angular/material/icon';

@Component({
  selector: 'app-checker',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    MatIcon
  ],
  templateUrl: './checker.component.html',
  styleUrl: './checker.component.scss'
})
export class CheckerComponent {

}
