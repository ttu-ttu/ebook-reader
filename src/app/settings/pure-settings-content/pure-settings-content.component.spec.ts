/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { PureSettingsContentComponent } from './pure-settings-content.component';
import { PureSettingsContentModule } from './pure-settings-content.module';

describe('PureSettingsContentComponent', () => {
  let spectator: Spectator<PureSettingsContentComponent>;
  const createComponent = createComponentFactory({
    component: PureSettingsContentComponent,
    imports: [PureSettingsContentModule],
  });

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });
});
