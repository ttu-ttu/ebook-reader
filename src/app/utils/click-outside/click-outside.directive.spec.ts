/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import {
  createDirectiveFactory,
  SpectatorDirective,
} from '@ngneat/spectator/jest';
import { ClickOutsideDirective } from './click-outside.directive';

describe('ClickOutsideDirective ', () => {
  let spectator: SpectatorDirective<ClickOutsideDirective>;
  const createDirective = createDirectiveFactory(ClickOutsideDirective);

  it('should get the instance', () => {
    spectator = createDirective(
      `<div appClickOutside>Testing ClickOutsideDirective</div>`
    );
    const instance = spectator.directive;
    expect(instance).toBeDefined();
  });

  it('emits on click outside', () => {
    spectator = createDirective(
      `<div appClickOutside>Testing ClickOutsideDirective</div><div data-random-loc><div>`
    );
    const outsideEl = spectator.query('[data-random-loc]')!;

    let output;
    spectator.output('clickOutside').subscribe((result) => {
      output = result;
    });

    expect(output).toBeFalsy();
    spectator.dispatchMouseEvent(spectator.element, 'click');
    expect(output).toBeFalsy();
    spectator.dispatchMouseEvent(outsideEl, 'click');
    expect(output).toBeTruthy();
  });
});
