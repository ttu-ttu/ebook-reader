/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Compares the deployed version (/version.txt) with GitHub, for the admin panel's
 * Updates tool: the latest release (stable) or the main branch (bleeding edge). The update itself is done by the server's
 * ebook-update (account.ts requestUpdate). Not part of upstream.
 */

import { writableStringLocalStorageSubject } from '$lib/data/internal/writable-string-local-storage-subject';

export const defaultUpdateRepo = 'blankiekun/chimimouryou';
export const engineRepo = 'blankiekun/CONscripter';

export type UpdateChannel = 'stable' | 'edge';

export const updateChannel$ = writableStringLocalStorageSubject<UpdateChannel>()(
  'updateChannel',
  'stable'
);

export interface UpdateCheck {
  /** What it was compared with: the latest release's tag, or main. */
  target: string;
  /** Deployed commit; empty if version.txt doesn't name one (e.g. a plain docker build). */
  current: string;
  /** Deployed with uncommitted changes. */
  dirty: boolean;
  /** The target's commit. */
  latest: string;
  /** behind: the target has newer commits; unknown: the deployed commit isn't on GitHub. */
  state: 'current' | 'behind' | 'ahead' | 'diverged' | 'unknown';
  /** Commits in the target that aren't deployed, newest first. */
  commits: { sha: string; message: string }[];
}

/** The commit in version.txt (deploy.sh: git describe --always --dirty). */
export function commitOfVersion(version: string) {
  const match = version.trim().match(/(?:^|-g)([0-9a-f]{7,40})(?:-dirty)?$/);

  return { commit: match ? match[1] : '', dirty: version.trim().endsWith('-dirty') };
}

async function github(repo: string, path: string) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store'
  });

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(
      response.status === 403 || response.status === 429
        ? 'GitHub rate limit reached; try again in a while'
        : `GitHub answered HTTP ${response.status}`
    );
  }

  return response.json();
}

export async function checkForUpdate(
  repo: string,
  version: string,
  channel: UpdateChannel = 'edge'
): Promise<UpdateCheck> {
  const { commit: current, dirty } = commitOfVersion(version);
  let target = 'main';

  if (channel === 'stable') {
    const release = await github(repo, 'releases/latest');

    if (!release) {
      throw new Error(`${repo} has no release on GitHub`);
    }

    target = release.tag_name;
  }

  const compare = current ? await github(repo, `compare/${current}...${target}`) : undefined;

  if (!compare) {
    const head = await github(repo, `commits/${target}`);

    if (!head) {
      throw new Error(`${repo} has no ${target} on GitHub`);
    }

    return { target, current, dirty, latest: head.sha, state: 'unknown', commits: [] };
  }

  const commits: { sha: string; commit: { message: string } }[] = compare.commits ?? [];
  // GitHub describes the target relative to the deployed commit.
  const state = ({ identical: 'current', ahead: 'behind', behind: 'ahead' } as const)[
    compare.status as 'identical' | 'ahead' | 'behind'
  ];

  return {
    target,
    current,
    dirty,
    latest: commits.length ? commits[commits.length - 1].sha : current,
    state: state ?? 'diverged',
    commits: commits
      .map((entry) => ({ sha: entry.sha, message: entry.commit.message.split('\n')[0] }))
      .reverse()
  };
}

/** The visual novel engine's version (static/vn/conscripter-version.txt) and CONscripter's latest release. */
export async function checkEngineRelease(installed: string) {
  const release = await github(engineRepo, 'releases/latest');

  if (!release) {
    throw new Error(`${engineRepo} has no release on GitHub`);
  }

  const latest: string = release.tag_name;

  return {
    installed: installed.trim(),
    latest,
    url: release.html_url as string,
    newer: latest !== installed.trim(),
    /** build.sh needs the release's web build, which is uploaded after the tag. */
    webBuild: (release.assets ?? []).some((asset: { name: string }) =>
      asset.name.endsWith('_web.7z')
    )
  };
}
