/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

// A LAN address: on localhost the plain-HTTP warning is hidden (nothing crosses a network).
// @vitest-environment-options {"url": "http://books.lan/"}

import { BehaviorSubject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { account$ } from '$lib/data/account';

// Settings sync pulls in the whole store (IndexedDB, media queries); not under test here.
vi.mock('$lib/data/account-settings-sync', () => ({
  readerProfile: () => 'desktop',
  readerProfileLabels: { desktop: 'desktop' },
  settingsSyncState$: new BehaviorSubject({ state: 'idle' }),
  syncAccountSettings: vi.fn()
}));

const { default: SettingsAccount } = await import('./settings-account.svelte');

/** The account API as seen from a signed-out plain-HTTP page (http://books.lan/). */
function stubServer(httpAccounts: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/config')) {
        return new Response(JSON.stringify({ httpAccounts }));
      }
      return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });
    })
  );
}

async function mount() {
  const target = document.createElement('div');

  document.body.append(target);
  account$.next(null);
  new SettingsAccount({ target });
  await vi.waitFor(() => expect(target.textContent).not.toContain('Checking sign-in'));

  return target;
}

describe('SettingsAccount on plain HTTP', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('points to the HTTPS address when the server keeps accounts on HTTPS (default)', async () => {
    stubServer(false);
    const target = await mount();

    expect(target.querySelector('form')).toBeNull();
    expect(target.textContent).toContain('Signing in only works on the secure address');
  });

  it('offers sign-in with a warning when the server allows HTTP accounts', async () => {
    stubServer(true);
    const target = await mount();

    expect(target.querySelector('input[type=password]')).not.toBeNull();
    expect(target.querySelector('[role=alert]')?.textContent).toContain('Not encrypted');
  });
});
