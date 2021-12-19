/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PureBookContentComponent } from './pure-book-content.component';

@NgModule({
  declarations: [PureBookContentComponent],
  imports: [CommonModule],
  exports: [PureBookContentComponent],
})
export class PureBookContentModule {}
