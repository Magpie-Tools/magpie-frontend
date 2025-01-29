import {Component, inject} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatSnackBar} from '@angular/material/snack-bar';
import {SettingsService} from '../services/settings.service';
import {MatTab, MatTabGroup} from '@angular/material/tabs';
import {TooltipComponent} from '../tooltip/tooltip.component';
import {MatDivider} from '@angular/material/divider';
import {MatFormField} from '@angular/material/form-field';
import {MatOption, MatSelect} from '@angular/material/select';
import {NgForOf} from '@angular/common';
import {CheckboxComponent} from '../checkbox/checkbox.component';
import {MatIcon} from '@angular/material/icon';

@Component({
  selector: 'app-checker',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    MatTab,
    TooltipComponent,
    MatDivider,
    MatFormField,
    MatSelect,
    MatOption,
    NgForOf,
    CheckboxComponent,
    MatTabGroup,
    MatIcon
  ],
  templateUrl: './checker.component.html',
  styleUrl: './checker.component.scss'
})
export class CheckerComponent {
  settingsForm: FormGroup;

  constructor(private fb: FormBuilder, private settingsService: SettingsService) {
    this.settingsForm = this.fb.group({
      threads: [250],
      retries: [2],
      timeout: [7500],
      selectedPorts: this.fb.group({
        http: [false],
        https: [true],
        socks4: [false],
        socks5: [false],
      }),
      timer: this.fb.group({
        days: [0],
        hours: [1],
        minutes: [0],
        seconds: [0]
      }),
      iplookup: ['https://ident.me'],
      judges_threads: [3],
      judges_timeout: [5000],
      judges: this.fb.array([
        this.fb.group({ url: ['https://pool.proxyspace.pro/judge.php'], regex: ['default'] }),
        this.fb.group({ url: ['http://azenv.net'], regex: ['default'] })
      ]),
      blacklisted: this.fb.array([
        ['https://www.spamhaus.org/drop/drop.txt'],
        ['https://www.spamhaus.org/drop/edrop.txt'],
        ['http://myip.ms/files/blacklist/general/latest_blacklist.txt']
      ])
    });
  }

  daysList = Array.from({ length: 31 }, (_, i) => i);
  hoursList = Array.from({ length: 24 }, (_, i) => i);
  minutesList = Array.from({ length: 60 }, (_, i) => i);
  secondsList = Array.from({ length: 60 }, (_, i) => i);

  get judges() {
    return this.settingsForm.get('judges') as FormArray;
  }

  get blacklisted() {
    return this.settingsForm.get('blacklisted') as FormArray;
  }

  private _snackBar = inject(MatSnackBar);

  onSubmit() {
    this.settingsService.saveSettings(this.settingsForm.value).subscribe({
      next: (resp) => {
        this._snackBar.open(resp, "Close", { duration: 3000 });
      },
      error: (err) => {
        console.error("Error saving settings:", err);
        this._snackBar.open("Failed to save settings!", "Close", { duration: 3000 });
      }
    });
  }
}
