/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { SettingsItemGroupComponent } from './settings-item-group.component';

describe('SettingsItemGroupComponent', () => {
  let spectator: Spectator<SettingsItemGroupComponent>;
  const createComponent = createComponentFactory(SettingsItemGroupComponent);

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });
});
