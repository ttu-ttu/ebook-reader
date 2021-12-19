/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PureBookReaderHeaderModule } from '../pure-book-reader-header/pure-book-reader-header.module';
import { BookReaderHeaderComponent } from './book-reader-header.component';

@NgModule({
  declarations: [BookReaderHeaderComponent],
  imports: [CommonModule, PureBookReaderHeaderModule],
  exports: [BookReaderHeaderComponent],
})
export class BookReaderHeaderModule {}
