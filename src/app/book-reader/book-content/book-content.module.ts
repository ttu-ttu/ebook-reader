/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PureBookContentModule } from '../pure-book-content/pure-book-content.module';
import { BookContentComponent } from './book-content.component';

@NgModule({
  declarations: [BookContentComponent],
  imports: [CommonModule, PureBookContentModule],
  exports: [BookContentComponent],
})
export class BookContentModule {}
