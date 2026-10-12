/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkForUpdate, commitOfVersion } from './app-update';

function github(routes: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = url.replace('https://api.github.com/repos/o/r/', '');

      return path in routes
        ? new Response(JSON.stringify(routes[path]))
        : new Response('{}', { status: 404 });
    })
  );
}

describe('app update check', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the commit from version.txt', () => {
    expect(commitOfVersion('b3cadf4d\n')).toEqual({ commit: 'b3cadf4d', dirty: false });
    expect(commitOfVersion('v2.0.0-12-gb3cadf4d-dirty')).toEqual({
      commit: 'b3cadf4d',
      dirty: true
    });
    expect(commitOfVersion('docker').commit).toBe('');
  });

  it('lists newer commits on main, newest first', async () => {
    github({
      'compare/aaaaaaa...main': {
        status: 'ahead',
        commits: [
          { sha: 'b1', commit: { message: 'feat: one\n\nbody' } },
          { sha: 'b2', commit: { message: 'fix: two' } }
        ]
      }
    });

    expect(await checkForUpdate('o/r', 'aaaaaaa')).toEqual({
      current: 'aaaaaaa',
      dirty: false,
      latest: 'b2',
      state: 'behind',
      commits: [
        { sha: 'b2', message: 'fix: two' },
        { sha: 'b1', message: 'feat: one' }
      ]
    });
  });

  it('is unknown when the deployed commit is not on GitHub', async () => {
    github({ 'commits/main': { sha: 'c9' } });

    const check = await checkForUpdate('o/r', 'deadbee-dirty');

    expect([check.state, check.latest, check.dirty]).toEqual(['unknown', 'c9', true]);
  });
});
