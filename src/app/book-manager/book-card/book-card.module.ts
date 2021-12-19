/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { BookCardComponent } from './book-card.component';
import { ImageResolverPipe } from './image-resolver.pipe';

@NgModule({
  declarations: [BookCardComponent, ImageResolverPipe],
  imports: [CommonModule, FontAwesomeModule],
  exports: [BookCardComponent],
})
export class BookCardModule {}
