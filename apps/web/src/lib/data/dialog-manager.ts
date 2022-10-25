/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { writableSubject } from '$lib/functions/svelte/store';

export interface Dialog {
  component: (new (...args: any[]) => any) | string;
  props?: Record<string, any>;
  disableCloseOnClick?: boolean;
}

const dialogs$ = writableSubject<Dialog[]>([]);

export const dialogManager = {
  dialogs$
};
