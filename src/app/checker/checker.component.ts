import { Component } from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {NgForOf} from '@angular/common';

@Component({
  selector: 'app-checker',
  standalone: true,
  imports: [
    MatIcon,
    ReactiveFormsModule,
    NgForOf
  ],
  templateUrl: './checker.component.html',
  styleUrl: './checker.component.scss'
})
export class CheckerComponent {
  settingsForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.settingsForm = this.fb.group({
      threads: [250],
      retries: [2],
      timeout: [7500],
      privacy_mode: [false],
      copyToClipboard: [false],
      autoSelect: this.fb.group({
        http: [false],
        https: [false],
        socks4: [false],
        socks5: [false],
      }),
      autoSave: this.fb.group({
        timeBetweenSafes: [15],
        'ip:port': [false],
        'protocol://ip:port': [false],
        'ip:port;time': [false],
        custom: ['']
      }),
      timeBetweenRefresh: [100],
      iplookup: ['http://api.ipify.org/'],
      judges_threads: [3],
      judges_timeout: [5000],
      judges: this.fb.array([
        this.fb.group({ url: ['http://azenv.net'], regex: ['default'] }),
        this.fb.group({ url: ['http://httpbin.org/headers'], regex: ['default'] }),
        this.fb.group({ url: ['https://pool.proxyspace.pro/judge.php'], regex: ['default'] }),
        this.fb.group({ url: ['https://httpbingo.org/headers'], regex: ['default'] }),
        this.fb.group({ url: ['https://postman-echo.com/headers'], regex: ['default'] }),
      ]),
      blacklisted: this.fb.array([
        ['https://www.spamhaus.org/drop/drop.txt'],
        ['https://www.spamhaus.org/drop/edrop.txt'],
        ['http://myip.ms/files/blacklist/general/latest_blacklist.txt']
      ]),
      bancheck: [''],
      keywords: this.fb.array(['']),
      transport: this.fb.group({
        KeepAlive: [false],
        KeepAliveSeconds: [15],
        MaxIdleConns: [500],
        MaxIdleConnsPerHost: [100],
        IdleConnTimeout: [20],
        TLSHandshakeTimeout: [5],
        ExpectContinueTimeout: [1]
      }),
    });
  }

  get judges() {
    return this.settingsForm.get('judges') as FormArray;
  }

  get blacklisted() {
    return this.settingsForm.get('blacklisted') as FormArray;
  }

  get keywords() {
    return this.settingsForm.get('keywords') as FormArray;
  }

  addJudge() {
    this.judges.push(this.fb.group({ url: [''], regex: [''] }));
  }

  addBlacklist() {
    this.blacklisted.push(this.fb.control(''));
  }

  addKeyword() {
    this.keywords.push(this.fb.control(''));
  }

  onSubmit() {
    console.log(this.settingsForm.value);
  }
}
