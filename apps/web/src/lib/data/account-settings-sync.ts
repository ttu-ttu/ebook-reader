/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Syncs AI settings, themes and reader settings to the signed-in account
 * (settings.json in the account's WebDAV folder). Reader settings are kept
 * separately for phones and larger screens, e.g. one column on the phone and
 * two on the desktop. Each setting keeps the time it was last changed in this
 * browser, and the newer value wins per setting. Not part of upstream.
 */

import { BehaviorSubject, map, merge, skip, type Subscription } from 'rxjs';
import { accountSyncUrl, type AccountUser } from '$lib/data/account';
import {
  aiLanguage$,
  askAiDefaultPreset$,
  askAiPresets$,
  askAiReaderNote$,
  openRouterApiKey$,
  openRouterModel$,
  openRouterRecapModel$,
  lorebookAutoInterval$,
  elevenLabsApiKey$,
  elevenLabsModel$,
  ttsPlaybackRate$,
  ttsVoiceId$
} from '$lib/data/ai-settings';
import { homeBookTitles$, homeRemovedTitles$ } from '$lib/data/library-home';
import { logger } from '$lib/data/logger';
import {
  autoBookmark$,
  autoBookmarkTime$,
  autoPositionOnResize$,
  avoidPageBreak$,
  confirmClose$,
  customReadingPointEnabled$,
  disableWheelNavigation$,
  enableFontVPAL$,
  enableReaderWakeLock$,
  enableTapEdgeToFlip$,
  enableTextJustification$,
  enableTextWrapPretty$,
  enableVerticalFontKerning$,
  firstDimensionMargin$,
  fontFamilyGroupOne$,
  fontFamilyGroupTwo$,
  fontSize$,
  fontWeight$,
  furiganaStyle$,
  hideFurigana$,
  hideSpoilerImage$,
  hideSpoilerImageMode$,
  lineHeight$,
  manualBookmark$,
  pageColumns$,
  prioritizeReaderStyles$,
  secondDimensionMaxValue$,
  selectionToBookmarkEnabled$,
  showCharacterCounter$,
  showFooterChapterCharacterCounter$,
  showFooterChapterPercentage$,
  showPercentage$,
  swipeThreshold$,
  textIndentation$,
  textMarginMode$,
  textMarginValue$,
  theme$,
  verticalTextOrientation$,
  viewMode$,
  writingMode$
} from '$lib/data/store';
import { customAppThemes$, darkTheme$, followSystemTheme$ } from '$lib/data/theme/theme-store';

interface SettingsDocument {
  version: 1;
  values: Record<string, unknown>;
  /** Setting key → time it was last changed */
  modified: Record<string, number>;
}

type Store = BehaviorSubject<any>;

/** localStorage key → store, shared by all devices. Add a store here to sync it. */
const sharedSettings: Record<string, Store> = {
  theme: theme$,
  darkTheme: darkTheme$,
  followSystemTheme: followSystemTheme$,
  customAppThemes: customAppThemes$,
  openRouterApiKey: openRouterApiKey$,
  openRouterModel: openRouterModel$,
  openRouterRecapModel: openRouterRecapModel$,
  lorebookAutoInterval: lorebookAutoInterval$,
  aiLanguage: aiLanguage$,
  homeBookTitles: homeBookTitles$,
  homeRemovedTitles: homeRemovedTitles$,
  askAiPresets: askAiPresets$,
  askAiDefaultPreset: askAiDefaultPreset$,
  askAiReaderNote: askAiReaderNote$,
  elevenLabsApiKey: elevenLabsApiKey$,
  elevenLabsModel: elevenLabsModel$,
  ttsVoiceId: ttsVoiceId$,
  ttsPlaybackRate: ttsPlaybackRate$
};

/**
 * API keys among sharedSettings. They belong to the account: they are removed
 * from the browser when it signs out (or the session expires) or another account
 * signs in, so they are never used by, shown to or uploaded for someone else.
 */
const secretSettings = ['openRouterApiKey', 'elevenLabsApiKey'];

/** Settings → Reader: localStorage key → store, synced per reader profile. */
const readerSettings: Record<string, Store> = {
  fontFamilyGroupOne: fontFamilyGroupOne$,
  fontFamilyGroupTwo: fontFamilyGroupTwo$,
  fontWeight: fontWeight$,
  fontSize: fontSize$,
  lineHeight: lineHeight$,
  textIndentation: textIndentation$,
  textMarginMode: textMarginMode$,
  textMarginValue: textMarginValue$,
  enableTextJustification: enableTextJustification$,
  enableTextWrapPretty: enableTextWrapPretty$,
  prioritizeReaderStyles: prioritizeReaderStyles$,
  writingMode: writingMode$,
  verticalTextOrientation: verticalTextOrientation$,
  enableVerticalFontKerning: enableVerticalFontKerning$,
  enableFontVPAL: enableFontVPAL$,
  hideFurigana: hideFurigana$,
  furiganaStyle: furiganaStyle$,
  viewMode: viewMode$,
  pageColumns: pageColumns$,
  firstDimensionMargin: firstDimensionMargin$,
  secondDimensionMaxValue: secondDimensionMaxValue$,
  avoidPageBreak: avoidPageBreak$,
  hideSpoilerImage: hideSpoilerImage$,
  hideSpoilerImageMode: hideSpoilerImageMode$,
  showCharacterCounter: showCharacterCounter$,
  showPercentage: showPercentage$,
  showFooterChapterCharacterCounter: showFooterChapterCharacterCounter$,
  showFooterChapterPercentage: showFooterChapterPercentage$,
  manualBookmark: manualBookmark$,
  autoBookmark: autoBookmark$,
  autoBookmarkTime: autoBookmarkTime$,
  selectionToBookmarkEnabled: selectionToBookmarkEnabled$,
  customReadingPointEnabled: customReadingPointEnabled$,
  autoPositionOnResize: autoPositionOnResize$,
  swipeThreshold: swipeThreshold$,
  disableWheelNavigation: disableWheelNavigation$,
  enableTapEdgeToFlip: enableTapEdgeToFlip$,
  enableReaderWakeLock: enableReaderWakeLock$,
  confirmClose: confirmClose$
};

export type ReaderProfile = 'phone' | 'desktop';

export const readerProfileLabels: Record<ReaderProfile, string> = {
  phone: 'Phone',
  desktop: 'Desktop and tablet'
};

/** Phones (touch screen, short side under 600 px) keep their own reader settings. */
export function readerProfile(): ReaderProfile {
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const shortSide = Math.min(window.screen.width, window.screen.height);

  return touch && shortSide < 600 ? 'phone' : 'desktop';
}

interface SyncEntry {
  /** Key in settings.json (and in the change times) */
  key: string;
  /** Key of the store in localStorage */
  storageKey: string;
  store: Store;
}

function syncEntries(profile: ReaderProfile): SyncEntry[] {
  const entries = (settings: Record<string, Store>, prefix = '') =>
    Object.entries(settings).map(([storageKey, store]) => ({
      key: `${prefix}${storageKey}`,
      storageKey,
      store
    }));

  return [...entries(sharedSettings), ...entries(readerSettings, `reader.${profile}.`)];
}

export type SettingsSyncState =
  | { state: 'off' }
  | { state: 'syncing' }
  | { state: 'synced'; at: number }
  | { state: 'error'; message: string };

export const settingsSyncState$ = new BehaviorSubject<SettingsSyncState>({ state: 'off' });

const settingsUrl = `${accountSyncUrl}settings.json`;
const changeTimesKey = 'accountSettingsModified';
/** Account whose settings this browser holds (its change times and API keys). */
const ownerKey = 'accountSettingsOwner';
const uploadDelayMs = 1500;
const refreshOnFocusAfterMs = 60_000;

let entries: SyncEntry[] = [];
let changeSubscription: Subscription | undefined;
let applyingRemote = false;
let uploadTimer: ReturnType<typeof setTimeout> | undefined;
let lastSynced = 0;
let queue = Promise.resolve();

function readChangeTimes(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(changeTimesKey) || '{}');
  } catch {
    return {};
  }
}

function writeChangeTimes(times: Record<string, number>) {
  window.localStorage.setItem(changeTimesKey, JSON.stringify(times));
}

async function downloadSettings(): Promise<SettingsDocument> {
  const response = await fetch(settingsUrl, { cache: 'no-store' });

  if (response.status === 404) {
    return { version: 1, values: {}, modified: {} };
  }

  if (!response.ok) {
    throw new Error(
      response.status === 401 ? 'Sign-in expired' : `Download failed (HTTP ${response.status})`
    );
  }

  const { values = {}, modified = {} } = await response.json();

  return { version: 1, values, modified };
}

/** Browsers only keep requests alive after the tab closes up to 64 KiB in total. */
const keepaliveMaxBytes = 60_000;

async function uploadSettings(settings: SettingsDocument) {
  const body = JSON.stringify(settings);
  const response = await fetch(settingsUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
    // Finishes even if the tab is closed right after a change.
    keepalive: new Blob([body]).size <= keepaliveMaxBytes
  });

  if (!response.ok) {
    throw new Error(`Upload failed (HTTP ${response.status})`);
  }
}

function applyRemoteValue(store: Store, value: unknown) {
  if (JSON.stringify(store.getValue()) === JSON.stringify(value)) {
    return;
  }

  applyingRemote = true;
  store.next(value);
  applyingRemote = false;
}

/**
 * Applies settings that are newer in the account, and uploads settings that are
 * newer here (or were set before signing in and are missing from the account).
 */
async function syncOnce() {
  settingsSyncState$.next({ state: 'syncing' });

  const remote = await downloadSettings();
  const localTimes = readChangeTimes();
  let changedRemote = false;

  entries.forEach(({ key, storageKey, store }) => {
    const remoteTime = remote.modified[key] || 0;
    const localTime = localTimes[key] || 0;

    if (key in remote.values && remoteTime >= localTime) {
      applyRemoteValue(store, remote.values[key]);
      localTimes[key] = remoteTime;
    } else if (localTime > remoteTime || window.localStorage.getItem(storageKey) !== null) {
      remote.values[key] = store.getValue();
      remote.modified[key] = localTime || Date.now();
      localTimes[key] = remote.modified[key];
      changedRemote = true;
    }
  });

  writeChangeTimes(localTimes);

  if (changedRemote) {
    await uploadSettings(remote);
  }

  lastSynced = Date.now();
  settingsSyncState$.next({ state: 'synced', at: lastSynced });
}

/** Queues a sync; runs never overlap. */
export function syncAccountSettings(): Promise<void> {
  queue = queue.then(() =>
    syncOnce().catch((error: Error) => {
      logger.warn(`Settings sync failed: ${error.message}`);
      settingsSyncState$.next({ state: 'error', message: error.message });
    })
  );

  return queue;
}

function scheduleUpload() {
  clearTimeout(uploadTimer);
  uploadTimer = setTimeout(() => {
    uploadTimer = undefined;
    syncAccountSettings();
  }, uploadDelayMs);
}

function onFocus() {
  if (Date.now() - lastSynced > refreshOnFocusAfterMs) {
    syncAccountSettings();
  }
}

/** Uploads pending changes right away when the tab is hidden (it may be closed). */
function onVisibilityChange() {
  if (document.visibilityState === 'hidden' && uploadTimer) {
    clearTimeout(uploadTimer);
    uploadTimer = undefined;
    syncAccountSettings();
  }
}

/**
 * Forgets the previous account's API keys and change times when the browser is
 * signed out or another account signs in. Settings saved before owners were
 * recorded are adopted by the first account that syncs.
 */
function releasePreviousOwner(user: AccountUser | null) {
  const owner = window.localStorage.getItem(ownerKey);

  if (owner && owner !== user?.id) {
    secretSettings.forEach((key) => {
      sharedSettings[key].next('');
      window.localStorage.removeItem(key);
    });
    window.localStorage.removeItem(changeTimesKey);
    window.localStorage.removeItem(ownerKey);
  }

  if (user) {
    window.localStorage.setItem(ownerKey, user.id);
  }
}

/**
 * Called once per page load with the session state. With null (signed out or
 * expired) it only releases the previous account's API keys.
 */
export function startSettingsSync(user: AccountUser | null) {
  stopSettingsSync();
  releasePreviousOwner(user);

  if (!user) {
    return;
  }

  entries = syncEntries(readerProfile());
  changeSubscription = merge(
    ...entries.map(({ key, store }) =>
      store.pipe(
        skip(1),
        map(() => key)
      )
    )
  ).subscribe((key) => {
    if (!applyingRemote) {
      writeChangeTimes({ ...readChangeTimes(), [key]: Date.now() });
      scheduleUpload();
    }
  });

  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibilityChange);
  syncAccountSettings();
}

function stopSettingsSync() {
  changeSubscription?.unsubscribe();
  changeSubscription = undefined;
  clearTimeout(uploadTimer);
  uploadTimer = undefined;
  window.removeEventListener('focus', onFocus);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  settingsSyncState$.next({ state: 'off' });
}
