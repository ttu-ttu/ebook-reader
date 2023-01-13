/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import { browser } from '$app/environment';

const fakeStorage = {
  persist: async () => false,
  persisted: async () => false
};

export const storage = browser ? navigator.storage || fakeStorage : fakeStorage;
