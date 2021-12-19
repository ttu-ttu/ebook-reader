/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { SettingsHeaderComponent } from './settings-header.component';

describe('SettingsHeaderComponent', () => {
  let spectator: Spectator<SettingsHeaderComponent>;
  const createComponent = createComponentFactory({
    component: SettingsHeaderComponent,
    imports: [RouterTestingModule],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });
});
