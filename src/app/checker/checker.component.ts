import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatIcon} from '@angular/material/icon';
import { UserSettings } from '../models/UserSettings';
import {CheckboxComponent} from '../checkbox/checkbox.component';
import {MatDivider} from '@angular/material/divider';
import {MatTab, MatTabGroup} from '@angular/material/tabs';
import {SettingsService} from '../services/settings.service';
import {SnackbarService} from '../services/snackbar.service';

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

  constructor(private settingsService: SettingsService, private fb: FormBuilder) {
    this.settingsForm = this.createDefaultForm();
  }

  ngOnInit(): void {
    this.updateFormWithUserSettings(this.settingsService.getUserSettings())
  }

  private createDefaultForm(): FormGroup {
    return this.fb.group({
      HTTPProtocol: [false],
      HTTPSProtocol: [true],
      SOCKS4Protocol: [false],
      SOCKS5Protocol: [false],
      Timeout: [7500],
      Retries: [2],
      UseHttpsForSocks: [true]
    });
  }

  private updateFormWithUserSettings(settings: UserSettings | undefined): void {
    if (settings) {
      this.settingsForm.patchValue({
        HTTPProtocol: settings.http_protocol,
        HTTPSProtocol: settings.https_protocol,
        SOCKS4Protocol: settings.socks4_protocol,
        SOCKS5Protocol: settings.socks5_protocol,
        Timeout: settings.timeout,
        Retries: settings.retries,
        UseHttpsForSocks: settings.UseHttpsForSocks
      });
    }
  }

  onSubmit() {
    this.settingsService.saveUserSettings(this.settingsForm.value).subscribe({
      next: (resp) => {
        SnackbarService.openSnackbar(resp.message, 3000)
      },
      error: (err) => {
        console.error("Error saving settings:", err);
        SnackbarService.openSnackbar("Failed to save settings!", 3000);
      }
    });
  }
}
