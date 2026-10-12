/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openRouterApiKey$, openRouterModel$, elevenLabsApiKey$ } from '$lib/data/ai-settings';
import { startSettingsSync, syncAccountSettings } from './account-settings-sync';

// jsdom has no matchMedia; the theme store reads the system colour scheme on import.
vi.hoisted(() => {
  window.matchMedia ??= ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {}
    }) as never) as never;
});

const alice = { id: 'alice', username: 'alice' };
const bob = { id: 'bob', username: 'bob' };

let remote: { values: Record<string, unknown>; modified: Record<string, number> } | undefined;
let uploads: string[] = [];

function mockServer(initial?: typeof remote) {
  remote = initial;
  uploads = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        uploads.push(String(init.body));
        remote = JSON.parse(String(init.body));
        return new Response('', { status: 201 });
      }
      return remote ? new Response(JSON.stringify(remote)) : new Response('', { status: 404 });
    })
  );
}

/** Settings as left in this browser by `owner` (undefined: before owners were recorded). */
function leaveSettingsFrom(owner: string | undefined) {
  openRouterApiKey$.next('sk-or-alice');
  elevenLabsApiKey$.next('sk_eleven_alice');
  openRouterModel$.next('model/alice');
  window.localStorage.setItem(
    'accountSettingsModified',
    JSON.stringify({ openRouterApiKey: 2000, elevenLabsApiKey: 2000, openRouterModel: 2000 })
  );
  if (owner) {
    window.localStorage.setItem('accountSettingsOwner', owner);
  }
}

async function signInAs(user: typeof alice | null) {
  startSettingsSync(user);
  await syncAccountSettings();
}

describe('account settings sync', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // jsdom has no matchMedia (used to pick the reader profile).
    window.matchMedia = vi.fn(() => ({ matches: false }) as MediaQueryList);
  });

  afterEach(() => {
    startSettingsSync(null);
    vi.unstubAllGlobals();
  });

  it("doesn't upload or keep another account's API keys after switching accounts", async () => {
    leaveSettingsFrom('alice');
    mockServer({ values: {}, modified: {} });

    await signInAs(bob);

    expect(uploads.join()).not.toContain('sk-');
    expect(openRouterApiKey$.getValue()).toBe('');
    expect(elevenLabsApiKey$.getValue()).toBe('');
    expect(window.localStorage.getItem('openRouterApiKey')).toBeNull();
  });

  it('removes API keys from the browser when the account is signed out or expired', async () => {
    leaveSettingsFrom('alice');
    mockServer();

    await signInAs(null);

    expect(openRouterApiKey$.getValue()).toBe('');
    expect(elevenLabsApiKey$.getValue()).toBe('');
    // Non-secret settings stay.
    expect(openRouterModel$.getValue()).toBe('model/alice');
  });

  it('still syncs the same account', async () => {
    leaveSettingsFrom('alice');
    mockServer({ values: {}, modified: {} });

    await signInAs(alice);

    expect(uploads.join()).toContain('sk-or-alice');
    expect(openRouterApiKey$.getValue()).toBe('sk-or-alice');
  });

  it('adopts settings saved before owners were recorded', async () => {
    leaveSettingsFrom(undefined);
    mockServer({ values: {}, modified: {} });

    await signInAs(alice);

    expect(uploads.join()).toContain('sk-or-alice');
  });

  it("applies the new account's own keys", async () => {
    leaveSettingsFrom('alice');
    mockServer({ values: { openRouterApiKey: 'sk-or-bob' }, modified: { openRouterApiKey: 1 } });

    await signInAs(bob);

    expect(openRouterApiKey$.getValue()).toBe('sk-or-bob');
  });
});
