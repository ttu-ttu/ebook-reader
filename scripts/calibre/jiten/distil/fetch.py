"""Fetches jiten.moe volume scores for matched series: <= 75 requests/min, resumable, stops on trouble."""
import json, os, sys, time, urllib.request, urllib.error
UA = 'personal-ebook-reader difficulty research (one-off, rate-limited)'
API = 'https://api.jiten.moe/api/media-deck/{}/detail?pageSize=100&offset={}'
ids = json.load(open('jiten-data/matches.json'))['series']
os.makedirs('jiten-data/series', exist_ok=True)
last = 0.0
failures = 0
def get(url):
    global last, failures
    while True:
        time.sleep(max(0, last + 0.8 - time.time()))
        last = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                failures = 0
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = int(e.headers.get('Retry-After') or 60)
                print(f'429, waiting {wait}s', flush=True); time.sleep(wait); last = time.time()
                failures += 1
            elif e.code == 404:
                return None
            else:
                failures += 1
                print(f'HTTP {e.code} for {url}', flush=True); time.sleep(30)
        except (urllib.error.URLError, TimeoutError) as e:
            failures += 1
            print(f'error {e} for {url}', flush=True); time.sleep(30)
        if failures >= 5:
            sys.exit('Too many errors in a row; stopping.')
done = 0
for i, deck_id in enumerate(ids):
    path = f'jiten-data/series/{deck_id}.json'
    if os.path.exists(path):
        continue
    first = get(API.format(deck_id, 0))
    if first is None:
        continue
    subs = first['data']['subDecks']
    while len(subs) < (first.get('totalItems') or 0):
        page = get(API.format(deck_id, len(subs)))
        if not page or not page['data']['subDecks']:
            break
        subs += page['data']['subDecks']
    json.dump({'main': first['data']['mainDeck'], 'subDecks': subs}, open(path + '.tmp', 'w'), ensure_ascii=False)
    os.replace(path + '.tmp', path)
    done += 1
    if done % 50 == 0:
        print(f'{i + 1}/{len(ids)}', flush=True)
print('finished', len(os.listdir('jiten-data/series')), 'series saved', flush=True)
