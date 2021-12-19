/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { Pipe, PipeTransform } from '@angular/core';
import { ToggleOption } from 'src/app/models/toggle-option.model';
import { AvailableTheme } from './available-theme.model';

@Pipe({
  name: 'availableThemesToOptions',
})
export class AvailableThemesToOptionsPipe implements PipeTransform {
  transform(value: AvailableTheme[]): ToggleOption<AvailableTheme['theme']>[] {
    return value.map((t) => ({
      id: t.theme,
      text: 'ぁあ',
      style: {
        color: t.option.fontColor,
        'background-color': t.option.backgroundColor,
      },
    }));
  }
}
