import json, re, unicodedata, sys
def norm(t):
    t = unicodedata.normalize('NFKC', t or '').casefold()
    t = re.sub(r'[\(\[（【〔][^\)\]）】〕]*(文庫|ブックス|books|novels|ノベルス|電子|特典|版)[^\)\]）】〕]*[\)\]）】〕]', '', t)
    return re.sub(r'[\s・:：!！?？~〜～\-‐―—「」『』"\'.,、。]', '', t)
novels = json.load(open('jiten-data/novels.json'))
books = [b for b in json.load(open('jiten-data/catalog.json'))['books'] if b['format'] in ('EPUB', 'TXT', 'HTMLZ')]
by_title, by_series = {}, {}
for b in books:
    by_title.setdefault(norm(b['title']), []).append(b)
    if b['series']:
        by_series.setdefault(norm(b['series']), []).append(b)
single, series = [], []
for d in novels:
    names = {norm(d['originalTitle'])} | {norm(a) for a in d.get('aliases') or [] if isinstance(a, str)}
    names.discard('')
    if any(n in by_series for n in names):
        series.append(d)
    elif any(n in by_title for n in names):
        single.append(d)
if __name__ == "__main__": print('jiten novels', len(novels), '| match a Calibre series:', len(series), '| match a single title:', len(single))
if __name__ == "__main__": json.dump({'series': [d['deckId'] for d in series], 'single': [d['deckId'] for d in single]}, open('jiten-data/matches.json', 'w'))
if __name__ == "__main__": print('sample series:', [d['originalTitle'] for d in series[:8]]); print('sample single:', [d['originalTitle'] for d in single[:8]])
