/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { Subject } from 'rxjs';

export interface ReplicationProgress {
  progressToAdd: number;
  executionStart?: number;
  baseProgress?: number;
  maxProgress?: number;
}

export const replicationProgress$ = new Subject<ReplicationProgress>();
