"""Pairs Calibre books with jiten.moe algorithmic scores -> books.json (for extract.py) and labels.json."""
import json, os, re, unicodedata
from match import norm  # noqa: E402  (match.py re-runs its print; harmless)
novels = {d['deckId']: d for d in json.load(open('jiten-data/novels.json'))}
matches = json.load(open('jiten-data/matches.json'))
books = [b for b in json.load(open('jiten-data/catalog.json'))['books'] if b['format'] in ('EPUB', 'TXT', 'HTMLZ')]
by_title, by_series = {}, {}
for b in books:
    by_title.setdefault(norm(b['title']), b)
    if b['series'] and b['seriesIndex']:
        by_series.setdefault((norm(b['series']), float(b['seriesIndex'])), b)
labels = {}
def add(book, deck, group):
    score = deck.get('difficultyAlgorithmic')
    if score is not None and score >= 0 and book['id'] not in labels:
        labels[book['id']] = {'score': score, 'group': group, 'deck': deck['deckId']}
def names(d):
    return {norm(d['originalTitle'])} | {norm(a) for a in d.get('aliases') or [] if isinstance(a, str)} - {''}
for deck_id in matches['series']:
    path = f'jiten-data/series/{deck_id}.json'
    if not os.path.exists(path):
        continue
    data = json.load(open(path))
    keys = names(novels[deck_id])
    for sub in data['subDecks']:
        m = re.search(r'(\d+(?:\.\d+)?)', unicodedata.normalize('NFKC', sub['originalTitle']))
        if not m:
            continue
        for key in keys:
            book = by_series.get((key, float(m.group(1))))
            if book:
                add(book, sub, deck_id)
                break
    if not data['subDecks']:  # a single work that shares a series name
        for key in keys:
            if key in by_title:
                add(by_title[key], novels[deck_id], deck_id)
for deck_id in matches['single']:
    for key in names(novels[deck_id]):
        if key in by_title:
            add(by_title[key], novels[deck_id], deck_id)
            break
json.dump(labels, open('jiten-data/labels.json', 'w'))
by_id = {b['id']: b for b in books}
json.dump([{'id': i, 'file': by_id[i]['file'], 'format': by_id[i]['format']} for i in labels], open('jiten-data/books.json', 'w'))
print(len(labels), 'labelled books from', len({l['group'] for l in labels.values()}), 'jiten decks')
