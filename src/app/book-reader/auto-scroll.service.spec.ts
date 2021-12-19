/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { AutoScrollService } from './auto-scroll.service';

describe('AutoScrollService', () => {
  let spectator: SpectatorService<AutoScrollService>;
  const createService = createServiceFactory(AutoScrollService);

  beforeEach(() => (spectator = createService()));

  it('should...', () => {
    expect(spectator.service).toBeTruthy();
  });
});
