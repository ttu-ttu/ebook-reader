/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { keyBy, sortBy } from 'lodash-es';
import {
  BehaviorSubject,
  combineLatest,
  firstValueFrom,
  ReplaySubject,
} from 'rxjs';
import { startWith, switchMap, map, share } from 'rxjs/operators';
import { DatabaseService } from 'src/app/database/books-db/database.service';
import BookCard from 'src/app/models/book-card.model';
import { BooksDbBookData } from '../../database/books-db/versions/books-db';

@Component({
  selector: 'app-book-card-list',
  templateUrl: './book-card-list.component.html',
  styleUrls: ['./book-card-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookCardListComponent {
  @Input()
  currentBookId?: number;

  @Input()
  selectedBookIds = new Set<number>();

  @Output()
  bookClick = new EventEmitter<BookCard>();

  private bookPartialDataList$ = this.db.dataListChanged$.pipe(
    startWith(0),
    switchMap(() => this.getBookPartialDataList())
  );

  bookCards$ = combineLatest([
    this.bookPartialDataList$,
    this.db.bookmarks$,
  ]).pipe(
    map(([books, bookmarks]) => {
      const bookmarkMap = bookmarks.reduce<Record<string, number>>(
        (acc, cur) => {
          let progress = 0;
          if (typeof cur.progress === 'string') {
            progress = +cur.progress.slice(0, -1);
          } else if (cur.progress) {
            progress = cur.progress;
          }
          acc[cur.dataId] = progress;
          return acc;
        },
        {}
      );
      return books.map((b): BookCard => {
        const imagePath = this.storedImagePaths[b.id] || new ReplaySubject(1);
        this.storedImagePaths[b.id] = imagePath;
        return {
          id: b.id,
          title: b.title,
          imagePath,
          progress: bookmarkMap[b.id] || 0,
        };
      });
    }),
    share({
      connector: () => new BehaviorSubject<BookCard[]>([]),
      resetOnError: false,
      resetOnComplete: false,
      resetOnRefCountZero: false,
    })
  );

  private storedImagePaths: Record<string, BookCard['imagePath']> = {};

  private retrievedBookIds = new Set<number>();

  constructor(private db: DatabaseService) {}

  onRemoveBookClick(bookCard: Pick<BookCard, 'id'>) {
    this.db.deleteData([bookCard.id]);
  }

  async onVsUpdate(bookCards: Pick<BookCard, 'id'>[]) {
    let firstIndex: number | undefined;
    let lastIndex: number | undefined;

    for (const bookCard of bookCards) {
      if (!this.retrievedBookIds.has(bookCard.id)) {
        this.retrievedBookIds.add(bookCard.id);
        if (!firstIndex) {
          firstIndex = bookCard.id;
        } else {
          firstIndex = Math.min(bookCard.id, firstIndex);
        }
        if (!lastIndex) {
          lastIndex = bookCard.id;
        } else {
          lastIndex = Math.max(bookCard.id, lastIndex);
        }
      }
    }

    if (!firstIndex || !lastIndex) {
      return;
    }

    const books = await this.db.getDataListByQuery(
      IDBKeyRange.bound(firstIndex, lastIndex, false, false)
    );
    const allBookCards = await firstValueFrom(this.bookCards$);
    const allBookCardMap = keyBy(allBookCards, (b) => b.id);

    for (const book of books) {
      const bookCard = allBookCardMap[book.id];
      if (bookCard) {
        bookCard.imagePath.next(book.coverImage);
      }
    }
  }

  private async getBookPartialDataList() {
    const db = await this.db.db;

    const result: Pick<BooksDbBookData, 'id' | 'title'>[] = [];
    let cursor = await db
      .transaction('data')
      .store.index('title')
      .openKeyCursor();

    while (cursor) {
      result.push({
        id: cursor.primaryKey,
        title: cursor.key,
      });
      // eslint-disable-next-line no-await-in-loop
      cursor = await cursor.continue();
    }

    return sortBy(result, (r) => r.id);
  }
}
