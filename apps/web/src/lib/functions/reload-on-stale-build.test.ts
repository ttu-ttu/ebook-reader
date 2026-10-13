/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it, vi } from 'vitest';
import { reloadOnStaleBuild } from './reload-on-stale-build';

describe('reloadOnStaleBuild', () => {
  it('reloads once when a chunk of the old build fails, not again within a minute', () => {
    const target = new EventTarget();
    const reload = vi.fn();
    const win = Object.assign(target, {
      sessionStorage: window.sessionStorage,
      location: { reload }
    }) as unknown as Window;
    const fail = () => {
      const event = new Event('vite:preloadError', { cancelable: true });

      target.dispatchEvent(event);
      return event.defaultPrevented;
    };

    window.sessionStorage.clear();
    reloadOnStaleBuild(win);

    expect(fail()).toBe(true);
    expect(fail()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
