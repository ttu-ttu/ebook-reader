# Reposition New Cards: Book Reader Flow

## Scope

This documents how `Reposition New Cards` computes card order from book text before calling Anki Connect `repositionNewCards`.

Relevant code:

- `apps/web/src/lib/components/book-reader/book-reader.svelte`
- `apps/web/src/lib/functions/anki/color-book-content.ts`
- `apps/web/src/lib/data/anki/anki.ts`

## Inputs

UI parameters sent to `buildRepositionOrderForNewCards`:

- `startMode`: `bookmark` or `start`
- `rangeMode`: `to-end`, `tokens`, `chars`, `percent`
- `orderMode`: `book-order` or `occurrences`
- `minOccurrences`: minimum number of token occurrences required to be considered

Default behavior:

- `orderMode = book-order`
- `minOccurrences = 2` (strictly equivalent to "must appear more than once")

## Read Path

`buildRepositionOrderForNewCards` performs:

1. Tokenize selected text range with Yomitan (`tokenize`).
2. Build per-token aggregates:
   - occurrence count
   - first occurrence index in scanned token stream
3. Resolve tokens to card IDs using existing shared analysis path (`_resolveTokenAnalysisData`).
4. Filter tokens by `count >= minOccurrences`.
5. Sort tokens:
   - `book-order`: by first occurrence
   - `occurrences`: by count descending, tie-break by first occurrence
6. Build final `orderedCardIds` by walking sorted tokens and deduping card IDs while preserving first-seen order.

## Write Path

No IndexedDB writes are done by this flow.

Final mutation is delegated to Anki via:

- `repositionNewCardsByOrder` -> `Anki.repositionNewCards`.
