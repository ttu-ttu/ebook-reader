/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { BookReaderRoutingModule } from './book-reader-routing.module';
import { BookReaderComponent } from './book-reader.component';
import { PureBookReaderModule } from './pure-book-reader/pure-book-reader.module';

@NgModule({
  declarations: [BookReaderComponent],
  imports: [CommonModule, BookReaderRoutingModule, PureBookReaderModule],
})
export class BookReaderModule {}
