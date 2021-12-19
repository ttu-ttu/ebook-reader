/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { MatDialogRef } from '@angular/material/dialog';
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { UpdateDialogComponent } from './update-dialog.component';

describe('UpdateDialogComponent', () => {
  let spectator: Spectator<UpdateDialogComponent>;
  const createComponent = createComponentFactory({
    component: UpdateDialogComponent,
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
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });
});
