/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MessageDialogComponent } from './message-dialog.component';

@NgModule({
  declarations: [MessageDialogComponent],
  imports: [CommonModule, MatDialogModule, MatButtonModule, A11yModule],
})
export class MessageDialogModule {}
