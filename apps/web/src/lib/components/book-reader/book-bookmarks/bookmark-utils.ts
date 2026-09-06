/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { Section } from '$lib/data/database/books-db/versions/v6/books-db-v6';

export function generateBookmarkLabel(
  sections: Section[] | undefined,
  exploredCharCount: number,
  totalCharCount: number
): string {
  const safeCharCount = Math.max(1, exploredCharCount);
  const totalPercentage = Math.round((safeCharCount / (totalCharCount || 1)) * 100);

  if (!sections || sections.length === 0) {
    return `Bookmark · ${totalPercentage}%`;
  }

  const mainChapters = sections.filter((s) => !s.parentChapter);
  const currentChapter = [...mainChapters]
    .reverse()
    .find((ch) => (ch.startCharacter ?? 0) <= safeCharCount);

  if (!currentChapter?.label) {
    return `Bookmark · ${totalPercentage}%`;
  }

  const chapterStart = currentChapter.startCharacter ?? 0;
  const chapterChars = currentChapter.characters ?? 1;
  const chapterProgress = Math.max(
    0,
    Math.min(100, Math.round(((safeCharCount - chapterStart) / chapterChars) * 100))
  );

  return `${currentChapter.label} · ${chapterProgress}%`;
}
