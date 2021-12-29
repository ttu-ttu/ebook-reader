/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MessageDialogComponent } from './message-dialog.component';

@NgModule({
  declarations: [MessageDialogComponent],
  imports: [CommonModule],
  exports: [MessageDialogComponent],
})
export class MessageDialogModule {}
