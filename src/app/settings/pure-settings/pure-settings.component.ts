/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-pure-settings',
  templateUrl: './pure-settings.component.html',
  styleUrls: ['./pure-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PureSettingsComponent {
  @Input()
  leavePageLink = '/manage';
}
