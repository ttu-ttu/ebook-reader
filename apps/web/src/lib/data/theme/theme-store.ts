/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Active theme state. `theme$` (in store.ts) holds the selected theme id, or the
 * light theme when following the system's light/dark mode. Custom themes are
 * stored per browser and synced to the account when signed in. Not part of upstream.
 */

import { browser } from '$app/environment';
import { BehaviorSubject, combineLatest, distinctUntilChanged, map, shareReplay } from 'rxjs';
import { writableBooleanLocalStorageSubject } from '$lib/data/internal/writable-boolean-local-storage-subject';
import { writableObjectLocalStorageSubject } from '$lib/data/internal/writable-object-local-storage-subject';
import { writableStringLocalStorageSubject } from '$lib/data/internal/writable-string-local-storage-subject';
import { customThemes$, theme$ } from '$lib/data/store';
import {
  allThemeDefinitions,
  defaultDarkThemeId,
  migrateLegacyTheme,
  resolveTheme,
  type ThemeDefinition
} from '$lib/data/theme/themes';

export const customAppThemes$ = writableObjectLocalStorageSubject<
  Record<string, ThemeDefinition>
>()('customAppThemes', {});

/** Theme being edited in settings, shown live instead of the selected one. */
export const previewTheme$ = new BehaviorSubject<ThemeDefinition | undefined>(undefined);

// One-time move of upstream's reader-only custom themes.
const legacyThemes = customThemes$.getValue();

if (Object.keys(legacyThemes).length && !Object.keys(customAppThemes$.getValue()).length) {
  const migrated: Record<string, ThemeDefinition> = {};

  Object.entries(legacyThemes).forEach(([name, legacy]) => {
    const definition = migrateLegacyTheme(name, legacy as unknown as Record<string, string>);

    if (definition) {
      migrated[definition.id] = definition;
    }
  });

  customAppThemes$.next(migrated);
}

/** Switch between `theme$` (light) and `darkTheme$` with the system setting. */
export const followSystemTheme$ = writableBooleanLocalStorageSubject()('followSystemTheme', false);
export const darkTheme$ = writableStringLocalStorageSubject()('darkTheme', defaultDarkThemeId);

const darkQuery = browser ? window.matchMedia('(prefers-color-scheme: dark)') : undefined;

export const systemDark$ = new BehaviorSubject(!!darkQuery?.matches);

darkQuery?.addEventListener('change', (event) => systemDark$.next(event.matches));

/** Id of the theme in use (before previews). */
export const selectedThemeId$ = combineLatest([
  theme$,
  darkTheme$,
  followSystemTheme$,
  systemDark$
]).pipe(
  map(([light, dark, follow, systemDark]) => (follow && systemDark ? dark : light)),
  distinctUntilChanged(),
  shareReplay({ bufferSize: 1, refCount: false })
);

/** Picks a theme for the current mode (the dark slot while following a dark system). */
export function selectTheme(id: string) {
  if (followSystemTheme$.getValue() && systemDark$.getValue()) {
    darkTheme$.next(id);
  } else {
    theme$.next(id);
  }
}

export const themeDefinitions$ = customAppThemes$.pipe(
  map((custom) => allThemeDefinitions(custom)),
  shareReplay({ bufferSize: 1, refCount: false })
);

export const activeTheme$ = combineLatest([selectedThemeId$, customAppThemes$, previewTheme$]).pipe(
  map(([id, custom, preview]) =>
    preview
      ? resolveTheme(preview.id, { ...custom, [preview.id]: preview })
      : resolveTheme(id, custom)
  ),
  shareReplay({ bufferSize: 1, refCount: false })
);
