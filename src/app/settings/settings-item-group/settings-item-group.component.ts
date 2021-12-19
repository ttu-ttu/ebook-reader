/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
  selector: 'app-settings-item-group',
  templateUrl: './settings-item-group.component.html',
  styleUrls: ['./settings-item-group.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsItemGroupComponent {
  @Input()
  title!: string;
}
