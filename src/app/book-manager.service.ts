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
import { DatabaseService, BooksDb } from './database.service';
import { EbookDisplayManagerService } from './ebook-display-manager.service';

export interface BookTitle {
  id: number;
  title: string;
  cover: string;
  progress: string;
  coverLoaded: boolean;
  isSelected: boolean;
  useFallback: boolean;
  wasVisible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BookManagerService {

  currentBookId$ = new BehaviorSubject<number>(0);
  managerIsOpen$ = new BehaviorSubject<boolean>(false);
  db: IDBPDatabase<BooksDb> | undefined;
  fallbackCover = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIwAAADICAQAAACQAMHPAAABAElEQVR42u3QAQ0AAAwCoNu/9AtYw'
    + 'A0ikKOKAjFixIgRI0aMGDFixCBGjBgxYsSIESNGjBjEiBEjRowYMWLEiBGDGDFixIgRI0aMGDFiECNGjBgxYsSIESNGjBjEiBEjRowYMWLEiBGDG'
    + 'DFixIgRI0aMGDFiECNGjBgxYsSIESNGDGLEiBEjRowYMWLEiEGMGDFixIgRI0aMGDFiECNGjBgxYsSIESNGDGLEiBEjRowYMWLEiEGMGDFixIgRI0'
    + 'aMGDGIESNGjBgxYsSIESNGDGLEiBEjRowYMWLEiEGMGDFixIgRI0aMGDGIESNGjBgxYsSIESMGMWLEiBEjRoyYbQ8PhQDJHXyppAAAAABJRU5ErkJggg==';

  constructor(
    private databaseService: DatabaseService,
    private ebookDisplayManagerService: EbookDisplayManagerService,
    private router: Router,
  ) { }

  async getCoverThumbnail(title: string, blobs: Record<string, Blob>, coverImage?: Blob | string | undefined): Promise<string | Blob> {

    let cover = coverImage;

    if (!cover) {
      const blobNames = Object.keys(blobs);

      for (let index = 0, length = blobNames.length; index < length; index++) {
        const blobName = blobNames[index];
        if (/[\/]*cover/i.test(blobName)) {
          cover = blobs[blobName];
          break;
        }
      }

      if (!cover) {
        cover = blobNames.length ? blobs[blobNames[0]] : this.fallbackCover;
      }
    }

    let thumbnail = cover;

    if (cover instanceof Blob) {

      const blobUrl = URL.createObjectURL(cover);
      const img = await this.loadImage(blobUrl);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (ctx) {

        canvas.width = 140;
        canvas.height = 200;

        ctx.drawImage(img, 0, 0, 140, 200);

        thumbnail = await new Promise<Blob>(resolve => {
          canvas.toBlob(resolve as any, 'image/jpeg', 0.75);
        }).catch((error) => {
          console.error(`Error Creating Cover for ${title}: ${error.message}`);
          return this.getFallbackCover();
        });
      }
    }

    return thumbnail;
  }

  loadImage(blobUrl: string): Promise<HTMLImageElement> {

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.src = blobUrl;
      img.addEventListener('load', () => {
        URL.revokeObjectURL(blobUrl);
        resolve(img);
      });

      img.addEventListener('error', () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Error loading Image'));
      });
    });
  }

  getFallbackCover() {
    return this.fallbackCover;
  }

  async getBookCoverData(): Promise<[any, BooksDb['bookmark']['value'][], number]> {
    this.db = this.db || await this.databaseService.db;

    return Promise.all([this.getKeysAndTitles(), this.db.getAll('bookmark'), new Promise<number>(resolve => {
      this.currentBookId$.pipe(take(1)).subscribe(resolve);
    })]);
  }

  async getKeysAndTitles() {
    this.db = this.db || await this.databaseService.db;

    const map: any = {};
    let cursor = await this.db.transaction('data').store.index('title').openKeyCursor();

    while (cursor) {
      map[cursor.primaryKey] = cursor.key;
      cursor = await cursor.continue();
    }

    return map;
  }

  async deleteBook(dataId: number, deleteLastItem: boolean): Promise<boolean> {
    let tx;

    try {
      this.db = this.db || await this.databaseService.db;

      tx = this.db.transaction(['bookmark', 'data', 'lastItem'], 'readwrite');

      if (deleteLastItem) {
        await tx.objectStore('lastItem').delete(0);
      }

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

  async navigateTo(nextId: number, updateLastItem: boolean) {
    this.ebookDisplayManagerService.loadingFile$.next(true);
    this.db = this.db || await this.databaseService.db;

    if (nextId) {
      if (updateLastItem) {
        await this.db.put('lastItem', { dataId: nextId }, 0);
      }

      await this.router.navigate(['b', nextId], {
        queryParamsHandling: 'merge',
      });
      this.ebookDisplayManagerService.revalidateFile.next();
    } else {
      if (updateLastItem) {
        await this.db.delete('lastItem', 0);
      }

      await this.router.navigate([''], {
        queryParamsHandling: 'merge',
      });
      this.ebookDisplayManagerService.loadingFile$.next(false);
    }
  }
}
