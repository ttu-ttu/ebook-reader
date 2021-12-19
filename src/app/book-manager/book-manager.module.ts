/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { BookReaderRoutingModule } from './book-manager-routing.module';
import { BookManagerComponent } from './book-manager.component';
import { PureBookManagerModule } from './pure-book-manager/pure-book-manager.module';

@NgModule({
  declarations: [BookManagerComponent],
  imports: [CommonModule, BookReaderRoutingModule, PureBookManagerModule],
})
export class BookManagerModule {}
