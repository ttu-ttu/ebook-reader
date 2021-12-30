/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Inject,
  Input,
  Output,
} from '@angular/core';
import { DatabaseService } from 'src/app/database/books-db/database.service';
import { StoreService } from 'src/app/store.service';
import { FullscreenService } from 'src/app/utils/fullscreen.service';

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

  showFullscreenButton = this.fullscreenService.fullscreenEnabled;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private store: StoreService,
    private db: DatabaseService,
    private fullscreenService: FullscreenService
  ) {}

  onFullscreenClick() {
    if (!this.fullscreenService.fullscreenElement) {
      this.fullscreenService.requestFullscreen(this.document.documentElement);
      return;
    }
    this.fullscreenService.exitFullscreen();
  }

  onBookManagerClick() {
    this.db.deleteLastItem();
  }
}
