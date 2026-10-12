/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Difficulty bands as shown on jiten.moe (score 0-5). Not part of upstream.
 */

export const difficultyNames = ['Beginner', 'Easy', 'Average', 'Hard', 'Expert', 'Insane'] as const;

export function difficultyBand(difficulty: number) {
  return Math.min(Math.max(Math.floor(difficulty), 0), difficultyNames.length - 1);
}

export function difficultyName(difficulty: number) {
  return difficultyNames[difficultyBand(difficulty)];
}

/** Theme colour of the band (difficulty1-5; Insane shares Expert's). */
export function difficultyColor(difficulty: number) {
  return `var(--difficulty-${Math.min(difficultyBand(difficulty) + 1, 5)})`;
}
