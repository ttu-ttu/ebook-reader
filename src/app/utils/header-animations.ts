/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { animate, style, transition } from '@angular/animations';
import Easing from './easing';

const leaveDuration = '100ms';

export const iconInOut = [
  transition('void => *', [
    style({ transform: 'scale(0)', opacity: 0 }),
    animate(leaveDuration, style({ transform: 'scale(0)', opacity: 0 })),
    animate(`100ms ${Easing.decelerate}`),
  ]),
  transition('* => void', [
    animate(
      `${leaveDuration} ${Easing.accelerate}`,
      style({ transform: 'scale(0)', opacity: 0 })
    ),
  ]),
];
