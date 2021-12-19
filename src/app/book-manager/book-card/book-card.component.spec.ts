/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { BookCardComponent } from './book-card.component';
import { BookCardModule } from './book-card.module';

describe('BookItemComponent', () => {
  let spectator: Spectator<BookCardComponent>;
  const createComponent = createComponentFactory({
    component: BookCardComponent,
    imports: [BookCardModule],
    declareComponent: false,
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should create', () => {
    expect(spectator.component).toBeTruthy();
  });

  it('has placeholder image', async () => {
    spectator.setInput('imagePath', '');
    expect(spectator.query('fa-icon')).toBeTruthy();
    expect(spectator.query('img')).toBeFalsy();
  });

  it('can load image', async () => {
    spectator.setInput('imagePath', 'assets/icons/icon-512x512.png');
    expect(spectator.query('fa-icon')).toBeFalsy();
    expect(spectator.query('img')).toBeTruthy();
  });
});
