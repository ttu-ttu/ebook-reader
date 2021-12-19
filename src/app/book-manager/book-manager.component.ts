/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { map, startWith } from 'rxjs/operators';
import { DatabaseService } from '../database/books-db/database.service';
import { LogReportDialogComponent } from '../log-report-dialog/log-report-dialog.component';
import { LogReportDialogData } from '../log-report-dialog/types';
import BookCard from '../models/book-card.model';
import { StoreService } from '../store.service';
import loadEpub from '../utils/file-loaders/epub/load-epub';
import loadHtmlz from '../utils/file-loaders/htmlz/load-htmlz';
import formatPageTitle from '../utils/format-page-title';
import { LoggerService } from '../utils/logger/logger.service';

const supportedExtRegex = /\.(?:htmlz|epub)$/;

@Component({
  selector: 'app-book-manager',
  templateUrl: './book-manager.component.html',
  styleUrls: ['./book-manager.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookManagerComponent {
  isLoading$ = this.db.dataIds$.pipe(
    startWith(0),
    map((x) => x === 0)
  );

  isImporting$ = this.store.isImportingBooks$;

  bookIds$ = this.db.dataIds$;

  selectedBookIds = new Set<number>();

  selectMode = false;

  constructor(
    private db: DatabaseService,
    private store: StoreService,
    private router: Router,
    private dialog: MatDialog,
    private logger: LoggerService,
    @Inject(DOCUMENT) private document: Document,
    title: Title
  ) {
    title.setTitle(formatPageTitle('Book Manager'));
  }

  async onFilesChange(fileList: FileList | File[]) {
    this.store.isImportingBooks$.next(true);
    this.store.importBookProgress$.next(0);
    const files = Array.from(fileList).filter((f) =>
      supportedExtRegex.test(f.name)
    );
    let latestDataId: number | undefined;
    let hasError = false;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];

      try {
        /* eslint-disable no-await-in-loop */
        const storeData = file.name.endsWith('.epub')
          ? await loadEpub(file, this.document)
          : await loadHtmlz(file, this.document);

        latestDataId = await this.db.upsertData(storeData);
        /* eslint-enable no-await-in-loop */
      } catch (ex) {
        this.logger.error(ex);
        hasError = true;
      }
      this.store.importBookProgress$.next(i / files.length);
    }
    this.store.isImportingBooks$.next(false);

    if (hasError) {
      this.dialog.open<LogReportDialogComponent, LogReportDialogData>(
        LogReportDialogComponent,
        {
          data: {
            message: 'Failed to import some books',
          },
        }
      );
    }

    if (files.length === 1 && latestDataId !== undefined) {
      this.navigateToBookId(latestDataId);
    }
  }

  onOpenBookClick(bookCard: BookCard) {
    this.db.putLastItem(bookCard.id);
    this.navigateToBookId(bookCard.id);
  }

  async onRemoveClick(bookIds: number[]) {
    this.db.deleteData(bookIds);
  }

  onBugReportClick() {
    this.dialog.open<LogReportDialogComponent, LogReportDialogData>(
      LogReportDialogComponent,
      {
        data: {
          title: 'Bug Report',
          message: 'Please include the attached file for your report',
        },
      }
    );
  }

  private navigateToBookId(bookId: number) {
    this.router.navigate(['b', bookId]);
  }
}
