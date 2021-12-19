/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ToggleOption } from 'src/app/models/toggle-option.model';

@Component({
  selector: 'app-button-toggle-group',
  templateUrl: './button-toggle-group.component.html',
  styleUrls: ['./button-toggle-group.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonToggleGroupComponent {
  @Input()
  options: ToggleOption<any>[] = [];

  @Input()
  selectedOptionId: any;

  @Output()
  selectedOptionIdChange = new EventEmitter<any>();
}
