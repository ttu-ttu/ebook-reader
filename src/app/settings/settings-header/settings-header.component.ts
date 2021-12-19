/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { trigger } from '@angular/animations';
import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import { iconInOut } from 'src/app/utils/header-animations';

@Component({
  selector: 'app-settings-header',
  templateUrl: './settings-header.component.html',
  styleUrls: ['./settings-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [trigger('iconInOut', iconInOut)],
})
export class SettingsHeaderComponent {
  @Input()
  leavePageLink = '/manage';

  faSignOutAlt = faSignOutAlt;
}
