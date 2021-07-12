/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { IDBPDatabase } from 'idb';
import { BehaviorSubject } from 'rxjs';
import { take } from 'rxjs/operators';
import { BookmarkManagerService } from './bookmark-manager.service';
import { DatabaseService, BooksDb } from './database.service';
import { EbookDisplayManagerService } from './ebook-display-manager.service';
import { ScrollInformationService } from './scroll-information.service';

export interface BookTitle {
  id: number | undefined;
  name: string;
  cover: string | Blob;
  progress: string;
  coverLoaded: boolean;
  isSelected: boolean;
  useFallback: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BookManagerService {

  currentBookId$ = new BehaviorSubject<number>(0);
  managerIsOpen$ = new BehaviorSubject<boolean>(false);
  db: IDBPDatabase<BooksDb> | undefined;

  constructor(
    private bookmarkManagerService: BookmarkManagerService,
    private databaseService: DatabaseService,
    private ebookDisplayManagerService: EbookDisplayManagerService,
    private router: Router,
    private scrollInformationService: ScrollInformationService,
  ) { }

  deleteCurrentBook() {
    if (!window.confirm('Do you really want to delete the current Book?')) {
      return;
    }

    this.ebookDisplayManagerService.loadingFile$.next(true);
    this.currentBookId$.pipe(take(1)).subscribe(async (currentBookId) => {
      if (!await this.deleteBook(currentBookId)) {
        alert('Deletion failed');
        return this.ebookDisplayManagerService.loadingFile$.next(false);
      }

      this.navigateToNextBook(currentBookId).catch(error => {
        alert(`Navigation failed: ${error.message}`);
        this.ebookDisplayManagerService.loadingFile$.next(false);
      });
    });
  }

  async deleteBook(dataId: number): Promise<boolean> {
    let tx;

    try {
      this.db = this.db || await this.databaseService.db;

      tx = this.db.transaction(['bookmark', 'data'], 'readwrite');

      await tx.objectStore('bookmark').delete(dataId);
      await tx.objectStore('data').delete(dataId);
      await tx.done;

      return true;
    } catch (error) {
      console.error(`Deletion of BookId ${dataId} failed: ${error.message}`);

      tx?.abort();
      tx?.done.catch(() => { });
      return false;
    }
  }

  async getBookIds(): Promise<[Array<number>, number]> {
    this.db = this.db || await this.databaseService.db;

    return Promise.all([this.db.getAllKeys('data'), new Promise<number>(resolve => {
      this.currentBookId$.pipe(take(1)).subscribe(resolve);
    })]);
  }

  async navigateToNextBook(previousBookId: number) {
    let tx;
    this.db = this.db || await this.databaseService.db;

    tx = this.db.transaction(['data', 'lastItem'], 'readwrite');

    const dataStore = tx.objectStore('data');
    const nextBookId =
      (await dataStore.getKey(IDBKeyRange.lowerBound(previousBookId, true))) ||
      (await dataStore.getKey(IDBKeyRange.upperBound(previousBookId, true)));

    if (nextBookId) {
      await tx.objectStore('lastItem').put({ dataId: nextBookId }, 0);
    } else {
      await tx.objectStore('lastItem').delete(0);
    }

    if (nextBookId) {
      await this.router.navigate(['b', nextBookId]).catch(() => { });
    } else {
      this.bookmarkManagerService.setHideState(true);
      this.scrollInformationService.setOpacity(true);
    }
    this.ebookDisplayManagerService.revalidateFile.next();

    await tx.done;
  }
}
