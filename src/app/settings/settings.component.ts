/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { StoreService } from 'src/app/store.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  leavePageLink$ = this.store.previousUrl$;

  constructor(private store: StoreService) {}
}
