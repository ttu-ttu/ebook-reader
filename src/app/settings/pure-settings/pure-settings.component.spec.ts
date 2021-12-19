/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { PureSettingsComponent } from './pure-settings.component';

describe('PureSettingsComponent', () => {
  let spectator: Spectator<PureSettingsComponent>;
  const createComponent = createComponentFactory({
    component: PureSettingsComponent,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });
});
