/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { LoggerService } from '../utils/logger/logger.service';
import { LogReportDialogData } from './types';

@Component({
  selector: 'app-log-report-dialog',
  templateUrl: './log-report-dialog.component.html',
  styleUrls: ['./log-report-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogReportDialogComponent {
  downloadableLog$: Observable<SafeUrl>;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: LogReportDialogData,
    loggerService: LoggerService,
    domSanitizer: DomSanitizer
  ) {
    this.downloadableLog$ = loggerService.logHistoryUpdate$.pipe(
      startWith(0),
      map(() => {
        const encodedLog = encodeURIComponent(
          JSON.stringify(
            {
              userAgent: navigator.userAgent,
              log: loggerService.logHistory,
            },
            null,
            2
          )
        );

        return domSanitizer.bypassSecurityTrustUrl(
          `data:text/plain;charset=utf-8,${encodedLog}`
        );
      })
    );
  }
}
