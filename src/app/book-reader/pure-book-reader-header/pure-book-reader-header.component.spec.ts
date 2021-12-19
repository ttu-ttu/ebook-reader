/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { PureBookReaderHeaderComponent } from './pure-book-reader-header.component';

describe('PureBookReaderHeaderComponent', () => {
  let spectator: Spectator<PureBookReaderHeaderComponent>;
  const createComponent = createComponentFactory({
    component: PureBookReaderHeaderComponent,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });
});
