import {Component, OnInit} from '@angular/core';
import {CheckboxComponent} from "../../checkbox/checkbox.component";
import {FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule} from "@angular/forms";
import {MatDivider} from "@angular/material/divider";
import {MatFormField} from "@angular/material/form-field";
import {MatIcon} from "@angular/material/icon";
import {MatOption} from "@angular/material/core";
import {MatSelect} from "@angular/material/select";
import {MatTab, MatTabGroup} from "@angular/material/tabs";
import {NgForOf} from "@angular/common";
import {TooltipComponent} from "../../tooltip/tooltip.component";
import {SettingsService} from '../../services/settings.service';
import {take} from 'rxjs/operators';
import {SnackbarService} from '../../services/snackbar.service';

@Component({
  selector: 'app-admin-checker',
  standalone: true,
  imports: [
    CheckboxComponent,
    FormsModule,
    MatDivider,
    MatFormField,
    MatIcon,
    MatOption,
    MatSelect,
    MatTab,
    MatTabGroup,
    NgForOf,
    ReactiveFormsModule,
    TooltipComponent
  ],
  templateUrl: './admin-checker.component.html',
  styleUrl: './admin-checker.component.scss'
})
export class AdminCheckerComponent implements OnInit{
  settingsForm: FormGroup;
  daysList = Array.from({ length: 31 }, (_, i) => i);
  hoursList = Array.from({ length: 24 }, (_, i) => i);
  minutesList = Array.from({ length: 60 }, (_, i) => i);
  secondsList = Array.from({ length: 60 }, (_, i) => i);

  constructor(private fb: FormBuilder, private settingsService: SettingsService) {
    this.settingsForm = this.createDefaultForm();
  }

  ngOnInit(): void {
    this.settingsService.getCheckerSettings().pipe(take(1)).subscribe(checkerSettings => {
      if (checkerSettings) {
        this.updateFormWithCheckerSettings(checkerSettings);
        console.log(checkerSettings)
      }
    });

    // Load protocols and blacklist separately
    const settings = this.settingsService.getGlobalSettings();
    if (settings) {
      this.updateProtocolsAndBlacklist(settings.protocols, settings.blacklist_sources);
    }
  }

  private createDefaultForm(): FormGroup {
    return this.fb.group({
      threads: [250],
      retries: [2],
      timeout: [7500],
      protocols: this.fb.group({
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
      judges_threads: [3],
      judges_timeout: [5000],
      judge_timer: this.fb.group({
        days: [0],
        hours: [0],
        minutes: [30],
        seconds: [0]
      }),
      judges: this.fb.array([
        this.fb.group({ url: ['https://pool.proxyspace.pro/judge.php'], regex: ['default'] }),
        this.fb.group({ url: ['http://azenv.net'], regex: ['default'] })
      ]),
      use_https_for_socks: true,
      iplookup: ['https://ident.me'],
      standard_header: this.fb.array([
        "USER-AGENT", "HOST", "ACCEPT", "ACCEPT-ENCODING"
      ]),
      proxy_header: this.fb.array([
        "HTTP_X_FORWARDED_FOR", "HTTP_FORWARDED", "HTTP_VIA", "HTTP_X_PROXY_ID"
      ]),
      blacklisted: this.fb.array([])
    });
  }

  private updateFormWithCheckerSettings(checkerSettings: any): void {
    // Update checker-specific fields
    this.settingsForm.patchValue({
      threads: checkerSettings.threads,
      retries: checkerSettings.retries,
      timeout: checkerSettings.timeout,
      timer: {
        days: checkerSettings.checker_timer.days,
        hours: checkerSettings.checker_timer.hours,
        minutes: checkerSettings.checker_timer.minutes,
        seconds: checkerSettings.checker_timer.seconds
      },
      iplookup: checkerSettings.ip_lookup,
      judges_threads: checkerSettings.judges_threads,
      judges_timeout: checkerSettings.judges_timeout,
      use_https_for_socks: checkerSettings.use_https_for_socks
    });

    // Update judge timer if exists
    if (checkerSettings.judge_timer) {
      this.settingsForm.patchValue({
        judge_timer: {
          days: checkerSettings.judge_timer.days,
          hours: checkerSettings.judge_timer.hours,
          minutes: checkerSettings.judge_timer.minutes,
          seconds: checkerSettings.judge_timer.seconds
        }
      });
    }

    // Update judges array
    this.updateJudgesArray(checkerSettings.judges);

    // Update headers arrays
    this.updateHeadersArrays(
      checkerSettings.standard_header || ["USER-AGENT", "HOST", "ACCEPT", "ACCEPT-ENCODING"],
      checkerSettings.proxy_header || ["HTTP_X_FORWARDED_FOR", "HTTP_FORWARDED", "HTTP_VIA", "HTTP_X_PROXY_ID"]
    );
  }

  private updateProtocolsAndBlacklist(protocols: any, blacklist: string[]): void {
    if (protocols) {
      // Check if protocols is an object with boolean values
      if (protocols && typeof protocols === 'object') {
        const protocolsGroup = this.settingsForm.get('protocols') as FormGroup;

        // Set checkboxes based on protocol values
        Object.keys(protocols).forEach(protocol => {
          if (protocolsGroup.contains(protocol)) {
            protocolsGroup.get(protocol)?.setValue(!!protocols[protocol]);
          }
        });
      }
    }

    // Update blacklist
    if (blacklist && blacklist.length > 0) {
      const blacklistArray = this.settingsForm.get('blacklisted') as FormArray;
      blacklistArray.clear();
      blacklist.forEach(url => {
        blacklistArray.push(this.fb.control(url));
      });
    }
  }

  private updateJudgesArray(judges: any[]): void {
    if (!judges || judges.length === 0) return;

    const judgesArray = this.settingsForm.get('judges') as FormArray;
    judgesArray.clear();

    judges.forEach(judge => {
      judgesArray.push(this.fb.group({
        url: [judge.url],
        regex: [judge.regex]
      }));
    });
  }

  private updateHeadersArrays(standardHeaders: string[], proxyHeaders: string[]): void {
    const standardHeaderArray = this.settingsForm.get('standard_header') as FormArray;
    standardHeaderArray.clear();
    standardHeaders.forEach(header => {
      standardHeaderArray.push(this.fb.control(header));
    });

    const proxyHeaderArray = this.settingsForm.get('proxy_header') as FormArray;
    proxyHeaderArray.clear();
    proxyHeaders.forEach(header => {
      proxyHeaderArray.push(this.fb.control(header));
    });
  }

  get judges() {
    return this.settingsForm.get('judges') as FormArray;
  }

  get blacklisted() {
    return this.settingsForm.get('blacklisted') as FormArray;
  }

  get standardHeaders() {
    return this.settingsForm.get('standard_header') as FormArray;
  }

  get proxyHeaders() {
    return this.settingsForm.get('proxy_header') as FormArray;
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

  addJudge(): void {
    this.judges.push(this.fb.group({
      url: [''],
      regex: ['default']
    }));
  }

  removeJudge(index: number): void {
    this.judges.removeAt(index);
  }

  addBlacklistedUrl(): void {
    this.blacklisted.push(this.fb.control(''));
  }

  removeBlacklistedUrl(index: number): void {
    this.blacklisted.removeAt(index);
  }

  addStandardHeader(): void {
    this.standardHeaders.push(this.fb.control(''));
  }

  removeStandardHeader(index: number): void {
    this.standardHeaders.removeAt(index);
  }

  addProxyHeader(): void {
    this.proxyHeaders.push(this.fb.control(''));
  }

  removeProxyHeader(index: number): void {
    this.proxyHeaders.removeAt(index);
  }
}
