/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ClickOutsideModule } from '../../utils/click-outside/click-outside.module';
import { BookContentModule } from '../book-content/book-content.module';
import { BookReaderHeaderModule } from '../book-reader-header/book-reader-header.module';
import { PureBookReaderComponent } from './pure-book-reader.component';

@NgModule({
  declarations: [PureBookReaderComponent],
  imports: [
    CommonModule,
    BookReaderHeaderModule,
    BookContentModule,
    ClickOutsideModule,
  ],
  exports: [PureBookReaderComponent],
})
export class PureBookReaderModule {}
