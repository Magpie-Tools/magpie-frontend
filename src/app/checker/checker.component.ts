import {Component, OnInit} from '@angular/core';
import {FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatIcon} from '@angular/material/icon';
import {HttpService} from '../services/http.service';
import { UserSettings } from '../models/UserSettings';
import {CheckboxComponent} from '../checkbox/checkbox.component';
import {MatDivider} from '@angular/material/divider';
import {MatTab, MatTabGroup} from '@angular/material/tabs';

@Component({
  selector: 'app-checker',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    MatIcon,
    CheckboxComponent,
    MatDivider,
    MatTab,
    MatTabGroup
  ],
  templateUrl: './checker.component.html',
  styleUrl: './checker.component.scss'
})
export class CheckerComponent implements OnInit {
  settingsForm: FormGroup;
  userSettings: UserSettings | undefined;

  constructor(private http: HttpService) {
    this.settingsForm = new FormGroup({})
  }

  ngOnInit(): void {
      this.http.getUserSettings().subscribe(res => {this.userSettings = res})
  }


}
