/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/** Not part of upstream. */

function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!
  );
}

/** Minimal Markdown (bold, inline code, headings) on HTML-escaped text, for AI answers. */
export function renderBasicMarkdown(text: string) {
  return escapeHtml(text)
    .replace(/^#{1,6} (.*)$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}
