/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

const lastReloadKey = 'ttu-stale-build-reload';

/**
 * A page opened before a deploy still runs the old build, whose code chunks the server no
 * longer has: when one fails to load, reload once to get the new build. A second failure
 * within a minute is a real error (e.g. offline), so it is left to show.
 */
export function reloadOnStaleBuild(win: Window) {
  win.addEventListener('vite:preloadError', (event) => {
    const last = Number(win.sessionStorage.getItem(lastReloadKey) || 0);

    if (Date.now() - last < 60_000) return;

    win.sessionStorage.setItem(lastReloadKey, String(Date.now()));
    event.preventDefault();
    win.location.reload();
  });
}
