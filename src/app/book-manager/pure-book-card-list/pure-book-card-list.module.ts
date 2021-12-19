/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { VirtualScrollerModule } from '@iharbeck/ngx-virtual-scroller';
import { BookCardModule } from '../book-card/book-card.module';
import { HasPipe } from './has.pipe';
import { PureBookCardListComponent } from './pure-book-card-list.component';

@NgModule({
  declarations: [PureBookCardListComponent, HasPipe],
  imports: [
    CommonModule,
    BookCardModule,
    FontAwesomeModule,
    VirtualScrollerModule,
  ],
  exports: [PureBookCardListComponent],
})
export class PureBookCardListModule {}
