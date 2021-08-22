/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, ApplicationRef } from '@angular/core';
import { DomSanitizer, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { faClone } from '@fortawesome/free-regular-svg-icons';
import { faClone as faCloneSolid } from '@fortawesome/free-solid-svg-icons/faClone';
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons/faSignOutAlt';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash';
import { IDBPDatabase } from 'idb';
import { Subject, BehaviorSubject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { BookTitle, BookManagerService } from './../book-manager.service';
import { BooksDb, DatabaseService } from './../database.service';
import { EbookDisplayManagerService } from './../ebook-display-manager.service';

@Component({
  selector: 'app-book-manager',
  templateUrl: './book-manager.component.html',
  styleUrls: ['./book-manager.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookManagerComponent implements OnInit, OnDestroy {
  @ViewChild('scroll', { static: true }) scroller!: any;

  faClone = faClone;
  faCloneSolid = faCloneSolid;
  faSignOutAlt = faSignOutAlt;
  faTimes = faTimes;
  faTrash = faTrash;

  changeDetection$ = new Subject();
  queue$ = new BehaviorSubject<BookTitle[]>([]);
  db: IDBPDatabase<BooksDb> | undefined;
  handleQueue = false;
  books: BookTitle[] = [];
  blobUrls: string[] = [];
  currentBookId = 0;
  selectedBooks = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private applicationRef: ApplicationRef,
    private bookManagerService: BookManagerService,
    private changeDetectorRef: ChangeDetectorRef,
    private databaseService: DatabaseService,
    private domSanitizer: DomSanitizer,
    private ebookDisplayManagerService: EbookDisplayManagerService,
    private router: Router,
    private title: Title
  ) {
    this.changeDetection$.pipe(takeUntil(this.destroy$), debounceTime(100)).subscribe(() => {
      // tslint:disable-next-line: no-string-literal
      if (this.applicationRef['_runningTick']) {
        return;
      }
      applicationRef.tick();
    });
    this.queue$.pipe(takeUntil(this.destroy$)).subscribe(this.updateBookItems.bind(this));
    this.title.setTitle('Book Manager | ッツ Ebook Reader');
    this.bookManagerService.managerIsOpen$.next(true);
  }

  async ngOnInit() {
    this.db = this.db || await this.databaseService.db;

    if (null === window.localStorage.getItem('covers-created')) {
      await this.updateCoverData().then(() => {
        window.localStorage.setItem('covers-created', 'y');
      }).catch(() => { });
    }

    this.init();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.bookManagerService.managerIsOpen$.next(false);
  }

  async updateBookItems(data: BookTitle[]) {

    if (!this.handleQueue) {
      return;
    }

    let firstIndex;
    let lastIndex;

    for (let index = 0, length = data.length; index < length; index++) {
      const element = data[index];

      if (!element.wasVisible) {
        element.wasVisible = true;

        if (!firstIndex) {
          firstIndex = element.id;
        } else {
          lastIndex = element.id;
        }
      }
    }

    if (!firstIndex) {
      return;
    }

    if (!lastIndex) {
      lastIndex = firstIndex;
    }

    const bookData = await this.db?.getAll('data', IDBKeyRange.bound(firstIndex, lastIndex, false, false));

    if (!bookData) {
      return;
    }

    for (let index = 0, length = bookData.length; index < length; index++) {
      const element = bookData[index];
      const book = data.find((item) => item.id === element.id);

      if (!book) {
        continue;
      }

      if (!(element.coverImage instanceof Blob)) {
        book.coverLoaded = true;
        this.queueChangeDetection();
        continue;
      }

      const blobUrl = URL.createObjectURL(element.coverImage);
      this.blobUrls.push(blobUrl);

      book.useFallback = false;
      book.cover = this.domSanitizer.bypassSecurityTrustUrl(blobUrl) as string;
      this.queueChangeDetection();
    }
  }

  queueChangeDetection() {
    this.changeDetectorRef.markForCheck();
    this.changeDetection$.next();
  }

  async updateCoverData() {

    this.db = this.db || await this.databaseService.db;
    this.ebookDisplayManagerService.loadingFiles$.next({ title: 'Update Cover Data...', progress: '0%' });

    let errors = 0;
    const bookIds = await this.db.getAllKeys('data');

    for (let index = 0, length = bookIds.length; index < length; index++) {
      const bookId = bookIds[index];

      let book;

      try {
        this.ebookDisplayManagerService.loadingFiles$.next({
          title: 'Update Cover Data...',
          progress: `${Math.round(index / length * 100)}%`
        });

        book = await this.db.get('data', bookId);

        if (!book) {
          throw new Error('Book needs to be defined');
        }

        if (book.hasThumb) {
          continue;
        }

        book.coverImage = await this.bookManagerService.getCoverThumbnail(book.title, book.blobs);
        book.hasThumb = true;

        await this.db.put('data', book);
      } catch (error) {

        errors++;
        console.error(`Cover Import failed${book ? ` for ${book.title}` : ''}: ${error.message}...`);
      }
    }

    if (errors) {
      alert(`${errors} Cover Import(s) failed...`);
    }

    this.ebookDisplayManagerService.loadingFiles$.next(undefined);
  }

  async init() {
    try {
      const fallbackCover = this.bookManagerService.getFallbackCover();
      const [keysAndTitles, bookmarks, currentBookId] = await this.bookManagerService.getBookCoverData();
      const entries = Object.entries(keysAndTitles);

      if (!entries.length) {
        return this.closeManager();
      }

      let bookIndex = 0;

      this.currentBookId = currentBookId;

      for (const [key, bookTitle] of entries) {
        const bookId = parseInt(key, 10);
        const progress = bookmarks.find(bookmark => bookmark.dataId === bookId)?.progress || '0%';

        this.books.push({
          id: bookId, cover: fallbackCover, title: bookTitle as string, progress, coverLoaded: false, isSelected: false,
          useFallback: true, wasVisible: false
        });

        if (bookId === this.currentBookId) {
          bookIndex = this.books.length - 1;
        }
      }

      this.handleQueue = true;
      this.queueChangeDetection();
      this.scroller.scrollToIndex(bookIndex, true, 0, 0, () => {
        this.ebookDisplayManagerService.loadingFile$.next(false);
      });
    } catch (error) {
      alert(`Error opening Books: ${error.message}`);
      this.ebookDisplayManagerService.loadingFile$.next(false);
    }
  }

  async closeManager(updateLastItem = false) {
    this.ebookDisplayManagerService.loadingFile$.next(true);

    for (let index = 0, length = this.blobUrls.length; index < length; index++) {
      URL.revokeObjectURL(this.blobUrls[index]);
    }

    this.navigateTo(this.currentBookId, updateLastItem);
  }

  processBookSelection(shallSelect: boolean) {
    for (let index = 0, length = this.books.length; index < length; index++) {
      this.books[index].isSelected = shallSelect;
    }

    this.selectedBooks = shallSelect ? this.books.length : 0;
  }

  trackByFunction(_INDEX: number, book: BookTitle) {
    return book.id;
  }

  async executeDelete() {
    const targetBooks: number[] = [];

    targetBooks.push(...this.books.reduce(this.getSelectedBooksForDeletion, []));

    if (!window.confirm(`Do you really want to delete the selected ${targetBooks.length} Book(s)?`)) {
      return;
    }

    let currentBookDeleted = false;

    try {
      this.ebookDisplayManagerService.loadingFile$.next(true);

      let errors = 0;

      for (let index = 0, length = targetBooks.length; index < length; index++) {
        const toBeDeleted = targetBooks[index];
        const isCurrentBook = toBeDeleted === this.currentBookId;
        if (!(await this.bookManagerService.deleteBook(targetBooks[index], isCurrentBook))) {
          errors++;
        } else if (isCurrentBook) {
          currentBookDeleted = true;
          this.currentBookId = 0;
        }
      }

      if (errors) {
        alert(`${errors} Deletion(s) failed`);
      }

      this.selectedBooks = 0;
      this.books = this.books.filter(book => !targetBooks.includes(book.id));

      if (this.books.length) {
        this.queueChangeDetection();
        this.ebookDisplayManagerService.loadingFile$.next(false);
      } else {
        this.closeManager(true);
      }
    } catch (error) {
      alert(`Error on Deletion: ${error.message}`);
      this.ebookDisplayManagerService.loadingFile$.next(false);
    }
  }

  getSelectedBooksForDeletion(bookIds: number[], book: BookTitle) {
    if (book.isSelected && book.id) {
      bookIds.push(book.id);
    }
    return bookIds;
  }

  setImageToLoaded(book: BookTitle) {
    if (book.wasVisible && !book.coverLoaded) {
      book.coverLoaded = true;
    }
  }

  handleSelection(event: any, book: any) {
    book.isSelected = !book.isSelected;
    this.selectedBooks += book.isSelected ? 1 : -1;
    event.target.blur();
  }

  async navigateTo(nextId: number, updateLastItem = true) {
    this.ebookDisplayManagerService.loadingFile$.next(true);

    try {
      await this.bookManagerService.navigateTo(nextId, updateLastItem && (this.currentBookId !== nextId || !this.currentBookId));
    } catch (error) {
      alert(`Navigation failed: ${error.message}`);
      this.ebookDisplayManagerService.loadingFile$.next(false);
    }
  }
}
