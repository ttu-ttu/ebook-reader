/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PureBookCardListModule } from '../pure-book-card-list/pure-book-card-list.module';
import { BookCardListComponent } from './book-card-list.component';

@NgModule({
  declarations: [BookCardListComponent],
  imports: [CommonModule, PureBookCardListModule],
  exports: [BookCardListComponent],
})
export class BookCardListModule {}
