/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import { browser } from '$app/environment';

const fakeStorage = {
  persist: async () => false,
  persisted: async () => false,
  estimate: async () => ({ quota: 1, usage: 1 })
};

export const storage = browser ? navigator.storage || fakeStorage : fakeStorage;
