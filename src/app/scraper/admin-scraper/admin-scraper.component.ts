import {Component, OnInit} from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {NgForOf} from "@angular/common";
import {FormBuilder, FormGroup, ReactiveFormsModule} from "@angular/forms";
import {CheckboxComponent} from '../../checkbox/checkbox.component';
import {MatDivider} from '@angular/material/divider';
import {MatTab, MatTabGroup} from '@angular/material/tabs';
import {MatFormField} from '@angular/material/form-field';
import {MatOption} from '@angular/material/core';
import {MatSelect} from '@angular/material/select';
import {MatTooltip} from '@angular/material/tooltip';
import {TooltipComponent} from '../../tooltip/tooltip.component';
import {SettingsService} from '../../services/settings.service';
import {SnackbarService} from '../../services/snackbar.service';
import {take} from 'rxjs/operators';

@Component({
  selector: 'app-admin-scraper',
  standalone: true,
  imports: [
    MatIcon,
    NgForOf,
    ReactiveFormsModule,
    CheckboxComponent,
    MatDivider,
    MatTab,
    MatTabGroup,
    MatFormField,
    MatOption,
    MatSelect,
    MatTooltip,
    TooltipComponent
  ],
  templateUrl: './admin-scraper.component.html',
  styleUrl: './admin-scraper.component.scss'
})
export class AdminScraperComponent implements OnInit {
  daysList = Array.from({ length: 31 }, (_, i) => i);
  hoursList = Array.from({ length: 24 }, (_, i) => i);
  minutesList = Array.from({ length: 60 }, (_, i) => i);
  secondsList = Array.from({ length: 60 }, (_, i) => i);
  settingsForm: FormGroup;

  constructor(private fb: FormBuilder, private settingsService: SettingsService) {
    this.settingsForm = this.createDefaultForm();
  }

  ngOnInit(): void {
    this.settingsService.getScraperSettings().pipe(take(1)).subscribe(scraperSettings => {
      if (scraperSettings) {
        this.updateFormWithScraperSettings(scraperSettings);
      }
    });


    const threadsCtrl  = this.settingsForm.get('threads');
    const dynamicCtrl  = this.settingsForm.get('dynamic_threads');

    /* whenever the checkbox toggles, enable/disable “threads” */
    dynamicCtrl!.valueChanges.subscribe((isDynamic: boolean) => {
      isDynamic ? threadsCtrl!.disable({ emitEvent: false })
        : threadsCtrl!.enable({ emitEvent: false });
    });
  }

  private createDefaultForm(): FormGroup {
    return this.fb.group({
      dynamic_threads: true,
      threads: [{ value: 250, disabled: true }],
      retries: [2],
      timeout: [7500],
      scraper_timer: this.fb.group({
        days: [0],
        hours: [1],
        minutes: [0],
        seconds: [0]
      }),
      scrape_sites: [
        'https://raw.githubusercontent.com/dpangestuw/Free-Proxy/refs/heads/main/http_proxies.txt'
      ]
    });
  }

  private updateFormWithScraperSettings(scraperSettings: any): void {
    // Update checker-specific fields
    this.settingsForm.patchValue({
      dynamic_threads: scraperSettings.dynamic_threads,
      threads: scraperSettings.threads,
      retries: scraperSettings.retries,
      timeout: scraperSettings.timeout,
      scraper_timer: {
        days: scraperSettings.scraper_timer.days,
        hours: scraperSettings.scraper_timer.hours,
        minutes: scraperSettings.scraper_timer.minutes,
        seconds: scraperSettings.scraper_timer.seconds
      },
    });
  }


  onSubmit() {
    this.settingsService.saveGlobalSettings(this.settingsForm.value).subscribe({
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
