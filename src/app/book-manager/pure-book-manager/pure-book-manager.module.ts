/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { BookCardListModule } from '../book-card-list/book-card-list.module';
import { BookManagerHeaderModule } from '../book-manager-header/book-manager-header.module';
import { PureBookManagerComponent } from './pure-book-manager.component';

@NgModule({
  declarations: [PureBookManagerComponent],
  imports: [
    CommonModule,
    BookManagerHeaderModule,
    BookCardListModule,
    FontAwesomeModule,
  ],
  exports: [PureBookManagerComponent],
})
export class PureBookManagerModule {}
