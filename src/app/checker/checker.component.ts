import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, FormArray, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatIcon} from '@angular/material/icon';
import { UserSettings } from '../models/UserSettings';
import {CheckboxComponent} from '../checkbox/checkbox.component';
import {MatDivider} from '@angular/material/divider';
import {MatTab, MatTabGroup} from '@angular/material/tabs';
import {SettingsService} from '../services/settings.service';
import {SnackbarService} from '../services/snackbar.service';
import {CommonModule} from '@angular/common';
import {TooltipComponent} from '../tooltip/tooltip.component';

@Component({
    selector: 'app-checker',
    imports: [
        ReactiveFormsModule,
        FormsModule,
        MatIcon,
        CheckboxComponent,
        MatDivider,
        MatTab,
        MatTabGroup,
        CommonModule,
        TooltipComponent
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

  get judgesFormArray(): FormArray {
    return this.settingsForm.get('judges') as FormArray;
  }

  private createDefaultForm(): FormGroup {
    return this.fb.group({
      HTTPProtocol: [false],
      HTTPSProtocol: [true],
      SOCKS4Protocol: [false],
      SOCKS5Protocol: [false],
      Timeout: [7500],
      Retries: [2],
      UseHttpsForSocks: [true],
      judges: this.fb.array([])
    });
  }

  private createJudgeFormGroup(url: string = '', regex: string = ''): FormGroup {
    return this.fb.group({
      url: [url],
      regex: [regex]
    });
  }

  addJudge(): void {
    this.judgesFormArray.push(this.createJudgeFormGroup());
  }

  removeJudge(index: number): void {
    this.judgesFormArray.removeAt(index);
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
        UseHttpsForSocks: settings.UseHttpsForSocks,
        judges: settings.judges,
      });

      // Clear existing judges form array
      while (this.judgesFormArray.length !== 0) {
        this.judgesFormArray.removeAt(0);
      }

      // Add judges from settings
      if (settings.judges && settings.judges.length > 0) {
        settings.judges.forEach(judge => {
          this.judgesFormArray.push(this.createJudgeFormGroup(judge.url, judge.regex));
        });
      }
    }
  }

  onSubmit() {
    const formValues = this.settingsForm.value;

    this.settingsService.saveUserSettings(formValues).subscribe({
      next: (resp) => {
        SnackbarService.openSnackbar(resp.message, 3000)
        this.settingsForm.markAsPristine()
      },
      error: (err) => {
        console.error("Error saving settings:", err);
        SnackbarService.openSnackbar("Failed to save settings!", 3000);
      }
    });
  }
}
