/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ErrorDialogModule } from '../log-report-dialog/log-report-dialog.module';
import { MessageDialogModule } from '../message-dialog/message-dialog.module';
import { BookReaderRoutingModule } from './book-manager-routing.module';
import { BookManagerComponent } from './book-manager.component';
import { PureBookManagerModule } from './pure-book-manager/pure-book-manager.module';

@NgModule({
  declarations: [BookManagerComponent],
  imports: [
    CommonModule,
    BookReaderRoutingModule,
    PureBookManagerModule,
    MessageDialogModule,
    ErrorDialogModule,
  ],
})
export class BookManagerModule {}
