/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminAccount } from '$lib/data/account';

const api = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  setAccountPermissions: vi.fn(),
  setAccountAdmin: vi.fn()
}));

vi.mock('$lib/data/account', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/data/account')>()),
  ...api
}));

const { default: SettingsAdmin } = await import('./settings-admin.svelte');

const self: AdminAccount = { id: 'a', username: 'owner', admin: true, permissions: [], created: 0 };
const reader: AdminAccount = {
  id: 'b',
  username: 'bob',
  admin: false,
  permissions: ['series'],
  created: 0
};

async function mount() {
  const target = document.createElement('div');

  // Checkbox clicks only reach Svelte's handlers when the element is in the document.
  document.body.append(target);
  new SettingsAdmin({ target, props: { self } });
  await vi.waitFor(() => expect(target.querySelector('table')).not.toBeNull());

  /** Checkboxes of one table row: admin, then each permission. */
  const row = (username: string) =>
    [...target.querySelectorAll('tbody tr')]
      .find((tr) => tr.querySelector('th')?.textContent === username)!
      .querySelectorAll<HTMLInputElement>('input[type=checkbox]');

  return { row };
}

describe('SettingsAdmin permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listAccounts.mockResolvedValue([self, reader]);
    api.setAccountPermissions.mockResolvedValue({});
    api.setAccountAdmin.mockResolvedValue({});
  });

  it('shows admins with every permission, locked, and their own admin box disabled', async () => {
    const { row } = await mount();
    const boxes = [...row('owner')];

    expect(boxes.map((box) => box.checked)).toEqual([true, true, true, true]);
    expect(boxes.every((box) => box.disabled)).toBe(true);
    expect([...row('bob')].map((box) => box.checked)).toEqual([false, false, true, false]);
  });

  it('grants and revokes one permission, keeping the others', async () => {
    const { row } = await mount();

    row('bob')[1].click();
    await tick();
    expect(api.setAccountPermissions).toHaveBeenCalledWith('bob', ['series', 'import']);

    await vi.waitFor(() => expect(row('bob')[2].disabled).toBe(false));
    row('bob')[2].click();
    expect(api.setAccountPermissions).toHaveBeenLastCalledWith('bob', []);
  });

  it('leaves the box as the server has it when saving fails', async () => {
    api.setAccountPermissions.mockRejectedValue(new Error('Only admins can do this'));
    const { row } = await mount();

    row('bob')[3].click();
    await vi.waitFor(() => expect(row('bob')[3].disabled).toBe(false));

    expect(row('bob')[3].checked).toBe(false);
  });

  it('makes another account an admin', async () => {
    const { row } = await mount();

    row('bob')[0].click();

    expect(api.setAccountAdmin).toHaveBeenCalledWith('bob', true);
  });
});
