/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { createBooleanLocalStorageBehaviorSubject } from './utils/local-storage-utils';

@Injectable({
  providedIn: 'root'
})
export class UiSettingsService {
  showTooltips$: BehaviorSubject<boolean>;

  constructor() {
    this.showTooltips$ = createBooleanLocalStorageBehaviorSubject('showTooltips', true);
  }
}
