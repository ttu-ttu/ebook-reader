/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { Pipe, PipeTransform } from '@angular/core';
import { WritingMode } from 'src/app/models/writing-mode.model';

@Pipe({
  name: 'isWritingModeVertical',
})
export class IsWritingModeVerticalPipe implements PipeTransform {
  transform(value: WritingMode): boolean {
    return value === 'vertical-rl';
  }
}
