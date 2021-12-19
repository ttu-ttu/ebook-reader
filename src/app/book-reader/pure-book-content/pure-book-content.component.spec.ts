/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { WINDOW } from '../../utils/dom-tokens';
import { PureBookContentComponent } from './pure-book-content.component';

describe('PureBookContentComponent', () => {
  let spectator: Spectator<PureBookContentComponent>;
  const createComponent = createComponentFactory({
    component: PureBookContentComponent,
    providers: [
      {
        provide: WINDOW,
        useValue: window,
      },
    ],
  });

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });
});
