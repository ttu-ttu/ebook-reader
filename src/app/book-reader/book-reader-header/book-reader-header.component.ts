/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { DOCUMENT } from '@angular/common';
import {
  Inject,
  Component,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
  Input,
} from '@angular/core';
import { DatabaseService } from 'src/app/database/books-db/database.service';
import { StoreService } from 'src/app/store.service';

@Component({
  selector: 'app-book-reader-header',
  templateUrl: './book-reader-header.component.html',
  styleUrls: ['./book-reader-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookReaderHeaderComponent {
  @Input()
  autoScrollMultiplier$ = this.store.multiplier$;

  @Output()
  bookmarkClick = new EventEmitter<void>();

  @Output()
  leavingPage = new EventEmitter<void>();

  showFullscreenButton = this.document.fullscreenEnabled ?? false;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private store: StoreService,
    private db: DatabaseService
  ) {}

  onFullscreenClick() {
    if (!this.document.fullscreenElement) {
      this.document.documentElement.requestFullscreen();
      return;
    }
    this.document.exitFullscreen();
  }

  onBookManagerClick() {
    this.db.deleteLastItem();
  }
}
