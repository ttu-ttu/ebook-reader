/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, EventEmitter, Output, ViewChild, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { faMinusCircle } from '@fortawesome/free-solid-svg-icons/faMinusCircle';
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons/faPlusCircle';
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash';
import { IDBPDatabase } from 'idb';
import SwiperCore, {
  EffectCoverflow, Keyboard, Virtual
} from 'swiper/core';
import { BookTitle, BookManagerService } from './../book-manager.service';
import { BooksDb, DatabaseService } from './../database.service';
import { EbookDisplayManagerService } from './../ebook-display-manager.service';

SwiperCore.use([EffectCoverflow, Keyboard, Virtual]);

@Component({
  selector: 'app-book-manager',
  templateUrl: './book-manager.component.html',
  styleUrls: ['./book-manager.component.scss']
})
export class BookManagerComponent implements OnInit {

  @Output() closeClick = new EventEmitter<void>();
  @ViewChild('swiper', { static: true }) swiperElement!: any;

  faMinusCircle = faMinusCircle;
  faPlusCircle = faPlusCircle;
  faTrash = faTrash;

  db: IDBPDatabase<BooksDb> | undefined;
  bookIds: Array<number> = [];
  currentBookId = 0;
  coverAmount = 3;
  bookChunks = new Map();
  books: Array<BookTitle> = [];
  selectedBooks = 0;
  fallbackCover = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAEsCAQAAACoWRFeAAAAE0lEQVR42mNkYGAcRaNoFA0cAgAUvAEtNFICWAAAAABJRU5ErkJggg==';
  blobUrls: Array<string> = [];
  swiperInstance: SwiperCore | undefined;
  coverData = {
    offset: 0,
    from: 0,
    to: 0,
    slides: [] as Array<any>
  };
  allBooksEnabled = false;
  initialized = false;

  constructor(
    private bookManagerService: BookManagerService,
    private databaseService: DatabaseService,
    private domSanitizer: DomSanitizer,
    private ebookDisplayManagerService: EbookDisplayManagerService,
    private router: Router,
  ) { }

  ngOnInit() {
    this.bookManagerService.managerIsOpen$.subscribe(shallOpen => {
      if (shallOpen) {
        this.init();
      }
    });
  }

  async init() {
    try {
      this.db = this.db || await this.databaseService.db;
      ([this.bookIds, this.currentBookId] = (await this.bookManagerService.getBookIds()));
      this.coverAmount = window.matchMedia('(min-width: 900px)')?.matches ?
        Math.floor(window.innerWidth / 1.5 / 300) :
        Math.max(1, Math.ceil(window.innerWidth / 300));
      const bookIndex = this.bookIds.findIndex((book: any) => book === this.currentBookId);
      const lastIndex = this.bookIds.length - 1;
      const offset = this.coverAmount + 2;
      const offsetRange = offset * 2;
      const firstIdIndex = Math.max(bookIndex - offsetRange - 1, 0);
      const lastIdIndex = Math.min(bookIndex + offsetRange - 1, lastIndex);

      let nextIndex = firstIdIndex - 1;
      while (-1 < nextIndex) {
        const lowerBound = Math.max(nextIndex - offsetRange, 0);
        this.bookChunks.set(this.bookIds[nextIndex + offset], [lowerBound, nextIndex]);
        nextIndex = 0 === lowerBound ? -1 : lowerBound - 1;
      }

      nextIndex = lastIdIndex + 1;
      while (nextIndex < lastIndex) {
        const upperBound = Math.min(nextIndex + offsetRange, lastIndex);
        this.bookChunks.set(this.bookIds[nextIndex - offset], [nextIndex, upperBound]);
        nextIndex = lastIndex === upperBound ? lastIndex : upperBound + 1;
      }

      const books = await this.loadBooksChunk([firstIdIndex, lastIdIndex]);

      if (books.length < this.coverAmount) {
        this.coverAmount = books.length;
      }

      const extraSlides = Math.max(1, this.coverAmount - 2);

      this.swiperInstance = new SwiperCore(this.swiperElement.nativeElement, {
        slidesPerView: this.coverAmount,
        observer: true,
        resizeObserver: true,
        keyboard: true,
        grabCursor: true,
        centeredSlides: true,
        initialSlide: books.findIndex((book: any) => book.id === this.bookIds[bookIndex]),
        effect: 'coverflow',
        coverflowEffect: {
          slideShadows: false
        },
        virtual: {
          slides: this.books,
          addSlidesBefore: extraSlides,
          addSlidesAfter: extraSlides,
          renderExternal: async (data: any) => {
            let requiresUpdate = false;

            if (this.swiperInstance) {
              const activeId = this.books[this.swiperInstance.activeIndex].id || 0;

              if (this.bookChunks.has(activeId) && this.initialized) {
                try {
                  const operation = this.swiperInstance.previousIndex < this.swiperInstance.activeIndex ? 'push' : 'unshift';

                  await this.loadBooksChunk(this.bookChunks.get(activeId), false, operation);
                  this.bookChunks.delete(activeId);

                  if ('unshift' === operation) {
                    requiresUpdate = true;
                    this.swiperInstance.activeIndex = this.books.findIndex(book => book.id === activeId);
                  }
                } catch (error) {
                  if (this.initialized) {
                    alert(`Failed to load Book Chunk: ${error.message}`);
                  }
                }
              }
            }
            this.coverData = data;

            if (requiresUpdate) {
              this.swiperInstance?.update();
            }
          }
        },
        on: {
          doubleClick: (swiper: SwiperCore) => {
            this.books[swiper.activeIndex].isSelected = !this.books[swiper.activeIndex].isSelected;
            this.selectedBooks += this.books[swiper.activeIndex].isSelected ? 1 : -1;
          },
        }
      });
    } catch (error) {
      alert(`Error opening Books: ${error.message}`);
      this.ebookDisplayManagerService.loadingFile$.next(false);
      this.closeClick.emit();
    }
  }

  async loadBooksChunk([lowerBound, upperBound]: Array<number>, allowEmpty = true, operation = 'push') {

    if (!this.db) {
      return [];
    }

    const query = IDBKeyRange.bound(this.bookIds[lowerBound], this.bookIds[upperBound]);
    const [books, bookmarks] = await Promise.all([this.db.getAll('data', query), this.db.getAll('bookmark', query)]);

    const newBooks = [];

    if (!this.initialized && !allowEmpty) {
      return [];
    }

    for (let index = 0, length = books.length; index < length; index++) {
      // tslint:disable-next-line: prefer-const
      let { title: name, coverImage: cover = '', id, blobs } = books[index];

      let useFallback = false;

      if (!cover) {

        const blobNames = Object.keys(blobs);

        for (let index2 = 0, length2 = blobNames.length; index2 < length2; index2++) {
          const blobName = blobNames[index2];

          if (/\/cover/i.test(blobName)) {
            cover = blobs[blobName];
            break;
          }
        }

        if (!cover) {
          cover = blobNames.length ? blobs[blobNames[0]] : this.fallbackCover;
        }
      }

      if (cover instanceof Blob) {
        const blobUrl = URL.createObjectURL(cover);
        this.blobUrls.push(blobUrl);
        cover = this.domSanitizer.bypassSecurityTrustUrl(blobUrl) as string;
      } else {
        useFallback = true;
      }

      newBooks.push({
        id, name, cover, progress: bookmarks.find(bookmark => bookmark.dataId === id)?.progress || 'Unknown',
        coverLoaded: false, isSelected: this.allBooksEnabled, useFallback
      });
    }

    if ('push' === operation) {
      this.books.push(...newBooks);
    } else {
      this.books.unshift(...newBooks);
    }

    return books;
  }

  setImageToLoaded(book: BookTitle) {
    book.coverLoaded = true;

    if (book.id === this.currentBookId && !this.initialized) {
      this.initialized = true;
      this.ebookDisplayManagerService.loadingFile$.next(false);
      this.swiperInstance?.update();
    }
  }

  async navigateTo(nextId: number) {

    if (nextId === this.currentBookId) {
      return;
    }

    this.ebookDisplayManagerService.loadingFile$.next(true);

    try {

      await this.db?.put('lastItem', { dataId: nextId }, 0);
      await this.router.navigate(['b', nextId]);
      this.ebookDisplayManagerService.revalidateFile.next();
      this.closeManager();
    } catch (error) {
      alert(`Navigation failed: ${error.message}`);
      this.ebookDisplayManagerService.loadingFile$.next(false);
    }
  }

  closeManager() {
    this.closeClick.emit();

    this.initialized = false;
    this.allBooksEnabled = false;
    this.bookIds = [];
    this.bookChunks.clear();
    this.books = [];
    this.selectedBooks = 0;

    for (let index = 0, length = this.blobUrls.length; index < length; index++) {
      URL.revokeObjectURL(this.blobUrls[index]);
    }

    this.blobUrls = [];
    this.coverData = {
      offset: 0,
      from: 0,
      to: 0,
      slides: [] as Array<any>
    };
    this.swiperInstance?.destroy();
    this.swiperInstance = undefined;
  }

  processBookSelection(shallSelect: boolean) {
    this.allBooksEnabled = shallSelect;
    for (let index = 0, length = this.books.length; index < length; index++) {
      this.books[index].isSelected = shallSelect;
    }

    this.selectedBooks = shallSelect ? this.bookIds.length : 0;
  }

  async executeDelete() {
    const targetBooks = [];

    if (this.allBooksEnabled) {
      targetBooks.push(...this.bookIds);

      for (let index = 0, length = this.books.length; index < length; index++) {
        const book = this.books[index];

        if (!book.isSelected) {
          targetBooks.splice(targetBooks.findIndex(targetBook => targetBook === book.id), 1);
        }
      }
    } else {
      targetBooks.push(...this.books.reduce(this.getSelectedBooksForDeletion, []));
    }

    if (!window.confirm(`Do you really want to delete the selected ${targetBooks.length} Book(s)?`)) {
      return;
    }


    let currentBookDeleted = false;

    try {
      this.ebookDisplayManagerService.loadingFile$.next(true);

      let errors = 0;

      for (let index = 0, length = targetBooks.length; index < length; index++) {
        if (!(await this.bookManagerService.deleteBook(targetBooks[index]))) {
          errors++;
        } else if (this.currentBookId === targetBooks[index]) {
          currentBookDeleted = true;
        }
      }

      if (errors) {
        alert(`${errors} Deletion(s) failed`);
      }

      if (currentBookDeleted) {
        await this.bookManagerService.navigateToNextBook(this.currentBookId);
      } else {
        this.ebookDisplayManagerService.loadingFile$.next(false);
      }
    } catch (error) {
      alert(`Error on Deletion: ${error.message}`);
      this.ebookDisplayManagerService.loadingFile$.next(false);
    } finally {
      this.closeManager();
    }
  }

  getSelectedBooksForDeletion(bookIds: Array<number>, book: BookTitle) {
    if (book.isSelected && book.id) {
      bookIds.push(book.id);
    }
    return bookIds;
  }
}
