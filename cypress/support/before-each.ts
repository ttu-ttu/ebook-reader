/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { databaseManager } from './utils/db';

beforeEach(async () => {
  await databaseManager.closeDb();
});
