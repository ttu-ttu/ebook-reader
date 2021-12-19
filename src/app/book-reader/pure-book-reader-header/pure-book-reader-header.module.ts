/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { PureBookReaderHeaderComponent } from './pure-book-reader-header.component';

@NgModule({
  declarations: [PureBookReaderHeaderComponent],
  imports: [CommonModule, FontAwesomeModule, RouterModule],
  exports: [PureBookReaderHeaderComponent],
})
export class PureBookReaderHeaderModule {}
