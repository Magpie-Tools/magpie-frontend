import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule} from "@angular/forms";
import {SettingsService} from '../../services/settings.service';
import {take} from 'rxjs/operators';

import {TabsModule} from 'primeng/tabs';
import {SelectModule} from 'primeng/select';
import {InputNumberModule} from 'primeng/inputnumber';
import {ButtonModule} from 'primeng/button';
import {DividerModule} from 'primeng/divider';
import {TooltipModule} from 'primeng/tooltip';
import {CheckboxModule} from 'primeng/checkbox';
import {InputTextModule} from 'primeng/inputtext';
import {NotificationService} from '../../services/notification-service.service';

@Component({
  selector: 'app-admin-scraper',
  imports: [
    ReactiveFormsModule,
    TabsModule,
    SelectModule,
    InputNumberModule,
    ButtonModule,
    DividerModule,
    TooltipModule,
    CheckboxModule,
    InputTextModule
  ],
  templateUrl: './admin-scraper.component.html',
  styleUrl: './admin-scraper.component.scss'
})
export class AdminScraperComponent implements OnInit {
  daysList = Array.from({ length: 31 }, (_, i) => ({ label: `${i} Days`, value: i }));
  hoursList = Array.from({ length: 24 }, (_, i) => ({ label: `${i} Hours`, value: i }));
  minutesList = Array.from({ length: 60 }, (_, i) => ({ label: `${i} Minutes`, value: i }));
  secondsList = Array.from({ length: 60 }, (_, i) => ({ label: `${i} Seconds`, value: i }));
  settingsForm: FormGroup;

  constructor(private fb: FormBuilder, private settingsService: SettingsService) {
    this.settingsForm = this.createDefaultForm();
  }

  ngOnInit(): void {
    this.settingsService.getScraperSettings().pipe(take(1)).subscribe({
      next: scraperSettings => {
        if (scraperSettings) {
          this.updateFormWithScraperSettings(scraperSettings);
        }
      }, error: err => NotificationService.showError("Could not get scraper settings" + err.error.message)
    });

    const threadsCtrl  = this.settingsForm.get('scraper_threads');
    const dynamicCtrl  = this.settingsForm.get('scraper_dynamic_threads');

    /* whenever the checkbox toggles, enable/disable "threads" */
    dynamicCtrl!.valueChanges.subscribe({
      next: (isDynamic: boolean) => {
        isDynamic ? threadsCtrl!.disable({ emitEvent: false })
          : threadsCtrl!.enable({ emitEvent: false });
      }, error: err => NotificationService.showError("Error while toggling threadCtrl: " + err.error.message)
    });
  }

  private createDefaultForm(): FormGroup {
    return this.fb.group({
      scraper_dynamic_threads: true,
      scraper_threads: [{ value: 250, disabled: true }],
      scraper_retries: [2],
      scraper_timeout: [7500],
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
      scraper_dynamic_threads: scraperSettings.dynamic_threads,
      scraper_threads: scraperSettings.threads,
      scraper_retries: scraperSettings.retries,
      scraper_timeout: scraperSettings.timeout,
      scraper_timer: {
        days: scraperSettings.scraper_timer.days,
        hours: scraperSettings.scraper_timer.hours,
        minutes: scraperSettings.scraper_timer.minutes,
        seconds: scraperSettings.scraper_timer.seconds
      },
      scrape_sites: scraperSettings.scrape_sites,
    });
  }

  onSubmit() {
    this.settingsService.saveGlobalSettings(this.settingsForm.value).subscribe({
      next: (resp) => {
        NotificationService.showSuccess(resp.message)
        this.settingsForm.markAsPristine()
      },
      error: (err) => {
        console.error("Error saving settings:", err);
        NotificationService.showError("Failed to save settings: " + err.error.message);
      }
    });
  }
}
