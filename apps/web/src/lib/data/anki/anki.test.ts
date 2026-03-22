/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it, vi } from 'vitest';
import { Anki } from './anki';

describe('Anki cardsDetails field extraction', () => {
  it('extracts requested word fields from noteFields payload', () => {
    const anki = new Anki('http://127.0.0.1:8765', ['Word', 'Reading'], []) as any;

    const fields = anki._extractNoteFieldsFromFindCardsEntry({
      cardId: 123,
      noteFields: {
        Word: { value: '音楽' },
        Reading: 'おんがく'
      }
    });

    expect(fields.Word?.value).toBe('音楽');
    expect(fields.Reading?.value).toBe('おんがく');
  });

  it('keeps compatibility with nested fields and direct field fallback', () => {
    const anki = new Anki('http://127.0.0.1:8765', ['Word', 'Meaning'], []) as any;

    const fields = anki._extractNoteFieldsFromFindCardsEntry({
      cardId: 456,
      fields: {
        Word: { value: '面接官' }
      },
      Meaning: 'interviewer'
    });

    expect(fields.Word?.value).toBe('面接官');
    expect(fields.Meaning?.value).toBe('interviewer');
  });

  it('keeps warm-cache card words when cardsDetails returns noteFields only', async () => {
    const anki = new Anki('http://127.0.0.1:8765', ['Word'], ['MyDeck']) as any;
    const executeAction = vi.fn(async (action: string, params: Record<string, unknown>) => {
      if (action === 'findCards') {
        expect(params.query).toBe('"deck:MyDeck"');
        return { result: [1001] };
      }

      if (action === 'cardsDetails') {
        expect(params.cards).toEqual([1001]);
        expect(params.noteFields).toEqual(['Word']);
        expect(params.fields).toEqual(['prop:r', 'prop:s', 'due', 'queue', 'type']);
        return {
          result: [
            {
              cardId: 1001,
              noteFields: {
                Word: { value: '音楽' }
              },
              'prop:r': 0.93,
              'prop:s': 45,
              due: 0,
              queue: 2,
              type: 2
            }
          ]
        };
      }

      throw new Error(`Unexpected action in test: ${action}`);
    });
    anki._executeAction = executeAction;

    const cards = await anki.getAllCardsFromDecks(undefined, ['prop:r', 'prop:s']);

    expect(cards).toHaveLength(1);
    expect(cards[0].cardId).toBe(1001);
    expect(cards[0].fields.Word?.value).toBe('音楽');
  });
});
