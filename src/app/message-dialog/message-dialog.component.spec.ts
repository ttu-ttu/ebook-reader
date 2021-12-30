/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { MessageDialogComponent } from './message-dialog.component';
import { MessageDialogData } from './types';

describe('MessageDialogComponent', () => {
  let spectator: Spectator<MessageDialogComponent>;
  const createComponent = createComponentFactory({
    component: MessageDialogComponent,
    providers: [
      {
        provide: MatDialogRef,
        useValue: {
          close() {},
        },
      },
    ],
  });

  it('should create', () => {
    const dialogData: MessageDialogData = {
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

    expect(spectator.component).toBeTruthy();
  });
});
