/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Accounts on this server (scripts/calibre/account/). While signed in, reading
 * progress, statistics and highlights of Calibre books, and the settings in
 * account-settings-sync.ts, are stored in the account's own WebDAV folder at
 * /account/sync/ instead of the shared /calibre/sync/. Not part of upstream.
 */

import { browser } from '$app/environment';
import { BehaviorSubject } from 'rxjs';

export interface AccountUser {
  id: string;
  username: string;
  /** Admins manage accounts and have every permission; the server enforces both. */
  admin?: boolean;
  permissions?: AccountPermission[];
}

/** What admins can grant (account/service.py PERMISSIONS). */
export const accountPermissions = [
  { id: 'import', label: 'Add books', description: 'Add books to the Calibre library' },
  { id: 'series', label: 'Edit series', description: 'Change series for everyone' },
  { id: 'difficulty', label: 'Difficulty', description: 'Start difficulty estimates' }
] as const;

export type AccountPermission = (typeof accountPermissions)[number]['id'];

export interface AdminAccount extends AccountUser {
  created: number;
}

export const accountSyncUrl = '/account/sync/';

const accountApiUrl = '/account/api/';
const cachedUserKey = 'accountUser';

/** undefined until the session has been checked, null when signed out. */
export const account$ = new BehaviorSubject<AccountUser | null | undefined>(undefined);

let sessionChecked: Promise<AccountUser | null> | undefined;

function setUser(user: AccountUser | null) {
  if (user) {
    window.localStorage.setItem(cachedUserKey, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(cachedUserKey);
  }

  account$.next(user);
  sessionChecked = Promise.resolve(user);
}

function cachedUser(): AccountUser | null {
  try {
    return JSON.parse(window.localStorage.getItem(cachedUserKey) || 'null');
  } catch {
    return null;
  }
}

async function checkSession(): Promise<AccountUser | null> {
  try {
    const response = await fetch(`${accountApiUrl}me`, { cache: 'no-store' });

    if (response.ok) {
      return (await response.json()).user;
    }

    if (response.status === 401 || response.status === 404) {
      return null;
    }
  } catch {
    // Fall through to the cached state.
  }

  // Service unreachable: keep the last known state so personal data isn't
  // written to the shared folder by mistake; account requests will fail visibly.
  return cachedUser();
}

/** Resolves once it is known whether this browser is signed in. */
export function accountReady(): Promise<AccountUser | null> {
  if (!browser) {
    return Promise.resolve(null);
  }

  if (!sessionChecked) {
    sessionChecked = checkSession().then((user) => {
      setUser(user);
      return user;
    });
  }

  return sessionChecked;
}

/** Synchronous view for code that runs after accountReady(). */
export function currentAccount() {
  return account$.getValue() ?? null;
}

async function post<T>(action: string, body: object = {}): Promise<T> {
  const response = await fetch(`${accountApiUrl}${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data as T;
}

/**
 * Callers reload the page afterwards: storage handlers, caches and settings sync
 * assume one account per page load (see account-settings-sync.ts).
 */
export async function signIn(username: string, password: string) {
  const { user } = await post<{ user: AccountUser }>('login', { username, password });

  setUser(user);

  return user;
}

/** Callers reload the page afterwards, like signIn. */
export async function signOut() {
  await post('logout');
  setUser(null);
}

/** Also signs out the account's other sessions. */
export function changePassword(current: string, next: string) {
  return post('password', { current, new: next });
}

/** Copies progress, statistics and highlights saved while signed out into the account. */
export function importSharedData() {
  return post<{ books: number; files: number }>('import-shared');
}

/** Whether the account has reader data yet (to offer importSharedData). */
export async function accountHasReaderData() {
  const response = await fetch(accountSyncUrl, { cache: 'no-store' });

  if (!response.ok) {
    return false;
  }

  const entries: { name: string }[] = await response.json();

  return entries.some((entry) => entry.name !== 'settings.json');
}

/** Accounts on this server, for the admin panel. */
export async function listAccounts(): Promise<AdminAccount[]> {
  const response = await fetch(`${accountApiUrl}admin/users`, { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data.users;
}

export function addAccount(username: string, password: string, admin: boolean) {
  return post('admin/add', { username, password, admin });
}

/** Also signs out every session of that account. */
export function resetAccountPassword(username: string, password: string) {
  return post('admin/passwd', { username, password });
}

export function setAccountAdmin(username: string, admin: boolean) {
  return post('admin/set-admin', { username, admin });
}

export function setAccountPermissions(username: string, permissions: AccountPermission[]) {
  return post('admin/permissions', { username, permissions });
}

/** Whether a (signed-in) account may do this; admins may do everything. */
export function hasPermission(user: AccountUser | null | undefined, permission: AccountPermission) {
  return !!user && (!!user.admin || !!user.permissions?.includes(permission));
}

/** The account's data stays on the server. */
export function removeAccount(username: string) {
  return post('admin/remove', { username });
}

/**
 * Where to sign in when this page is plain HTTP: VITE_HTTPS_URL when the HTTPS
 * name differs from this one (e.g. a Tailscale name), otherwise this host over HTTPS.
 */
export function httpsAppUrl() {
  // Empty while prerendering; the page computes it again in the browser.
  return import.meta.env.VITE_HTTPS_URL || (browser ? `https://${window.location.host}` : '');
}

/** The session cookie is HTTPS-only, so signing in needs the secure address. */
export function signInAvailableHere() {
  return browser && window.location.protocol === 'https:';
}

/** A plain-HTTP page: passwords and sessions would cross the network unencrypted. */
export function isInsecurePage() {
  return browser && window.location.protocol === 'http:';
}

/** Whether this server allows accounts on plain-HTTP pages (ALLOW_HTTP_ACCOUNTS, off by default). */
export async function httpAccountsAllowed() {
  try {
    const response = await fetch(`${accountApiUrl}config`, { cache: 'no-store' });

    return response.ok && !!(await response.json()).httpAccounts;
  } catch {
    return false;
  }
}
