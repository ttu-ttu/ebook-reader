/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import type { StorageKey } from './storage/storage-types';
import { writableSubject } from '$lib/functions/svelte/store';

export interface SyncSelection {
  id: string;
  label: string;
  type: StorageKey;
}

export interface Dialog {
  component: (new (...args: any[]) => any) | string;
  props?: Record<string, any>;
  disableCloseOnClick?: boolean;
}

const dialogs$ = writableSubject<Dialog[]>([]);

export const dialogManager = {
  dialogs$
};
