"""Model inputs for labelled books (frequencies from the Yomitan dictionary). Resumable JSONL."""
import json, os, sys
from multiprocessing import Pool
HERE = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault('JITEN_STATE_DIR', os.path.join(HERE, 'state'))
sys.path.insert(0, os.path.join(HERE, 'jiten'))
LIBRARY = os.environ.get('CALIBRE_LIBRARY', '/library')
OUT = os.path.join(HERE, 'features.jsonl')
_a = _table = None

def init():
    global _a, _table
    from features import Analyzer
    from frequency import FrequencyTable
    _a = Analyzer()
    _table = FrequencyTable.load(os.path.join(HERE, 'frequency-dictionary.zip'))

def work(book):
    from features import TOKEN_CLEAN, book_text, compute_extra_features, compute_features
    try:
        ruby = {}
        text = book_text(os.path.join(LIBRARY, book['file']), book['format'], ruby)
        if len(TOKEN_CLEAN.sub('', text)) < 1000:
            return None
        a = _a.analyse(text)
        return {'id': book['id'], 'words': a.word_count, 'uniqueWords': len(a.words),
                'features': compute_features(a, _table), 'extra': compute_extra_features(a, _table, ruby)}
    except Exception as error:  # noqa: BLE001
        return {'id': book['id'], 'error': str(error)[:200]}

if __name__ == '__main__':
    books = json.load(open(os.path.join(HERE, 'books.json')))
    done = set()
    if os.path.exists(OUT):
        done = {json.loads(line)['id'] for line in open(OUT)}
    todo = [b for b in books if b['id'] not in done]
    print(f'{len(todo)} to do, {len(done)} done', flush=True)
    with Pool(int(sys.argv[1]) if len(sys.argv) > 1 else 4, initializer=init, maxtasksperchild=50) as pool, open(OUT, 'a') as out:
        for n, row in enumerate(pool.imap_unordered(work, todo), 1):
            if row:
                out.write(json.dumps(row) + '\n'); out.flush()
            if n % 100 == 0:
                print(n, flush=True)
    print('finished', flush=True)
