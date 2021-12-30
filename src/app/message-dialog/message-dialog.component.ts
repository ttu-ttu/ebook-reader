/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MessageDialogData } from './types';

@Component({
  selector: 'app-message-dialog',
  templateUrl: './message-dialog.component.html',
  styleUrls: ['./message-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MessageDialogData,
    public dialogRef: MatDialogRef<MessageDialogComponent>
  ) {}
}
