/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let spectator: Spectator<SettingsComponent>;
  const createComponent = createComponentFactory({
    component: SettingsComponent,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });
});
