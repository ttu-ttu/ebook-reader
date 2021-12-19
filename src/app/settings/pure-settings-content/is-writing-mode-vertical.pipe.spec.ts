/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { IsWritingModeVerticalPipe } from './is-writing-mode-vertical.pipe';

describe('IsWritingModeVerticalPipe ', () => {
  const pipe = new IsWritingModeVerticalPipe();

  it('should detect vertical', () => {
    expect(pipe.transform('vertical-rl')).toBeTruthy();
  });

  it('should detect horizontal', () => {
    expect(pipe.transform('horizontal-tb')).toBeFalsy();
  });
});
