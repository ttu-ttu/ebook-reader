/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { createComponentFactory } from '@ngneat/spectator/jest';
import { EMPTY, Subject } from 'rxjs';
import { DatabaseService } from 'src/app/database/books-db/database.service';
import { createBooksDb } from 'src/app/database/books-db/factory';
import BOOKS_DB_PROMISE from 'src/app/database/books-db/token';
import { PureBookCardListComponent } from '../pure-book-card-list/pure-book-card-list.component';
import { BookCardListComponent } from './book-card-list.component';

describe('BookCardListComponent', () => {
  const createComponent = createComponentFactory({
    component: BookCardListComponent,
    componentMocks: [PureBookCardListComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  it('should create', async () => {
    const dbStore = new DbStore();

    const spectator = createComponent({
      providers: [
        {
          provide: BOOKS_DB_PROMISE,
          useValue: dbStore.dbPromise,
        },
      ],
    });
    expect(spectator.component).toBeTruthy();
  });

  it('can delete', () => {
    const dbStore = new DbStore();
    const spy = jest.fn();
    const dbService = {
      db: dbStore.dbPromise,
      dataListChanged$: new Subject(),
      deleteData: spy,
    };
    const spectator = createComponent({
      providers: [
        {
          provide: DatabaseService,
          useValue: dbService,
        },
      ],
    });
    const bookId = Math.floor(Math.random() * 1000);
    spectator.component.onRemoveBookClick({
      id: bookId,
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith([bookId]);
  });
});

let counter = 0;

class DbStore {
  // eslint-disable-next-line no-plusplus
  dbPromise = createBooksDb(`BookCardListComponent_${counter++}`);

  bookCards$ = EMPTY;
}
