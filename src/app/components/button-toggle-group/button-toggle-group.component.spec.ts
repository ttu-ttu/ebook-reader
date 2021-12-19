/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { ButtonToggleGroupComponent } from './button-toggle-group.component';

describe('ButtonToggleGroupComponent', () => {
  let spectator: Spectator<ButtonToggleGroupComponent>;
  const createComponent = createComponentFactory(ButtonToggleGroupComponent);

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });
});
