/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Difficulty bands as shown on jiten.moe (score 0-5). Not part of upstream.
 */

export const difficultyNames = ['Beginner', 'Easy', 'Average', 'Hard', 'Expert', 'Insane'] as const;

/** Jiten's default palette, readable on light and dark backgrounds. */
const difficultyColors = ['#15803d', '#22c55e', '#06b6d4', '#d97706', '#dc2626', '#dc2626'];

export function difficultyBand(difficulty: number) {
  return Math.min(Math.max(Math.floor(difficulty), 0), difficultyNames.length - 1);
}

export function difficultyName(difficulty: number) {
  return difficultyNames[difficultyBand(difficulty)];
}

export function difficultyColor(difficulty: number) {
  return difficultyColors[difficultyBand(difficulty)];
}
