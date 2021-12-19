/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { SettingsContentComponent } from './settings-content.component';

describe('SettingsContentComponent', () => {
  let spectator: Spectator<SettingsContentComponent>;
  const createComponent = createComponentFactory({
    component: SettingsContentComponent,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });
});
