/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { browser } from '$app/env';

const fakeStorage = {
  persist: async () => false,
  persisted: async () => false
};

export const storage = browser ? navigator.storage || fakeStorage : fakeStorage;
