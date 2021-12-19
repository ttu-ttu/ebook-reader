/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'has',
})
export class HasPipe implements PipeTransform {
  transform<T>(list: Set<T>, value: T): boolean {
    return list.has(value);
  }
}
