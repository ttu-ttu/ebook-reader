/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import SeriesSuggestionsDialog from './series-suggestions-dialog.svelte';

const suggestions = [
  { title: '本 2', series: '本' },
  { title: '本 3', series: '本' },
  { title: '別 1', series: '別' }
];

function mount() {
  const target = document.createElement('div');
  const resolver = vi.fn();

  // Checkbox clicks only reach Svelte's handlers when the element is in the document.
  document.body.append(target);

  new SeriesSuggestionsDialog({ target, props: { suggestions, resolver } });

  const boxes = () => [...target.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
  const button = (text: string) =>
    [...target.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!;

  return { boxes, button, resolver };
}

describe('SeriesSuggestionsDialog', () => {
  it('asks once with every book checked', async () => {
    const { boxes, button, resolver } = mount();

    expect(boxes().map((box) => box.checked)).toEqual([true, true, true, true]);

    boxes()[2].click();
    await tick();
    button('to series').click();

    expect(resolver).toHaveBeenCalledWith({ '本 2': '本', '別 1': '別' });
  });

  it('checks and unchecks all at once, and Skip adds nothing', async () => {
    const { boxes, button, resolver } = mount();

    boxes()[0].click();
    await tick();
    expect(
      boxes()
        .slice(1)
        .every((box) => !box.checked)
    ).toBe(true);

    boxes()[0].click();
    await tick();
    expect(boxes().every((box) => box.checked)).toBe(true);

    button('Skip').click();
    expect(resolver).toHaveBeenCalledWith({});
  });
});
