/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { createComponentFactory } from '@ngneat/spectator/jest';
import { DatabaseService } from 'src/app/database/books-db/database.service';
import { BookReaderHeaderComponent } from './book-reader-header.component';

describe('BookReaderHeaderComponent', () => {
  const createComponent = createComponentFactory({
    component: BookReaderHeaderComponent,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const setup = () => {
    const spectator = createComponent({
      providers: [
        {
          provide: DatabaseService,
          useValue: {
            deleleLastItem: () => 0,
          },
        },
      ],
    });
    return {
      spectator,
    };
  };

  it('should create', () => {
    const { spectator } = setup();

    expect(spectator.component).toBeTruthy();
  });
});
