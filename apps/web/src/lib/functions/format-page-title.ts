/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

export function formatPageTitle(title: string) {
  const appName = 'ッツ Ebook Reader';
  if (!title) return appName;
  return `${title} | ${appName}`;
}
