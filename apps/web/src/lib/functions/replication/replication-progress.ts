/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import type { Entry } from '@zip.js/zip.js';
import { Subject } from 'rxjs';

export interface ReplicationContext {
  title: string;
  id?: number;
  imagePath?: string | Blob | Entry;
}

export interface ReplicationProgress {
  progressToAdd?: number;
  progressBase?: number;
  maxProgress?: number;
  skipStep?: boolean;
  completeStep?: boolean;
}

export interface ReplicationDeleteResult {
  error: string;
  deleted: number[];
}

export const replicationProgress$ = new Subject<ReplicationProgress>();
export const executeReplicate$ = new Subject<void>();
