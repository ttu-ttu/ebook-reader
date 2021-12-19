/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { LogReportDialogComponent } from './log-report-dialog.component';
import { LogReportDialogData } from './types';

describe('LogReportDialogComponent', () => {
  let spectator: Spectator<LogReportDialogComponent>;
  const createComponent = createComponentFactory(LogReportDialogComponent);

  it('should create without unsafe url', () => {
    const dialogData: LogReportDialogData = {
      title: 'My title',
      message: 'My message',
    };
    spectator = createComponent({
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: dialogData,
        },
      ],
    });

    const downloadEl: HTMLAnchorElement | null = spectator.query('a');

    if (!downloadEl) {
      throw new Error('Anchor not found');
    }

    expect(downloadEl.href).not.toMatch(/^unsafe:/);
  });
});
