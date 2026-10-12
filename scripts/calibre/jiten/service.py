#!/usr/bin/env python3
"""On-demand difficulty estimates for the Calibre library, with Jiten's features and a
model distilled from jiten.moe's scores (distil/). Word frequencies come from Jiten's
Yomitan frequency list (FREQUENCY_DICTIONARY).

Nothing runs until asked: the reader (or the CLI) requests difficulty for chosen books.

HTTP API (bound to localhost, proxied by nginx at /calibre/difficulty/api/):
  GET  status                       progress of the current job
  POST compute    {"ids": [...]}    estimate difficulty for these books ({"all": true} for all without a current estimate)
  POST cancel                       stop the running job
Results are written to RESULTS_PATH, which nginx serves as /calibre/difficulty.json.

CLI: service.py serve | compute ID... | import DIR
(`import` installs a difficulty.json made elsewhere by offline.py.)
"""
import json
import math
import os
import sys
import threading
import time
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))

LIBRARY = os.environ.get('CALIBRE_LIBRARY', '/library')
CATALOG_PATH = os.environ.get('CALIBRE_CATALOG', '/data/state/catalog/catalog.json')
STATE_DIR = os.environ.get('JITEN_STATE_DIR', '/data/state/difficulty')
# Rank-based Yomitan frequency dictionary: Jiten's list (jiten.moe/frequency-dictionaries).
FREQUENCY_DICTIONARY = os.environ.get('JITEN_FREQUENCY_DICTIONARY',
                                      os.path.join(STATE_DIR, 'frequency-dictionary.zip'))
RESULTS_PATH = os.path.join(STATE_DIR, 'difficulty.json')
# Jiten's model retrained on jiten.moe's own scores (distil/, README there): their scale directly,
# adjustment included, from the 55 features plus log characters and log unique kanji.
MODEL_PATH = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'difficulty_model_jiten_distilled.onnx')
# Stored with each estimate; whole-library runs redo estimates made by another model.
MODEL_VERSION = 'jiten-distilled-2'
WORKERS = int(os.environ.get('JITEN_WORKERS', os.cpu_count() or 1))
PORT = int(os.environ.get('JITEN_PORT', '8765'))
HOST = os.environ.get('JITEN_HOST', '127.0.0.1')
# Worker processes are replaced after this many books to bound their memory.
BOOKS_PER_POOL = 300


# ---------------------------------------------------------------------------
# Worker processes (one Sudachi tokenizer each)

_analyzer = None
_frequency = None
_session = None


def _init_worker():
    global _analyzer, _frequency, _session
    import warnings
    warnings.filterwarnings('ignore')
    import onnxruntime
    from features import Analyzer
    from frequency import FrequencyTable
    _analyzer = Analyzer()
    _frequency = FrequencyTable.load(FREQUENCY_DICTIONARY)
    options = onnxruntime.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    _session = onnxruntime.InferenceSession(MODEL_PATH, options)


def _estimate(book: dict):
    import numpy
    from features import FEATURE_ORDER, TOKEN_CLEAN, book_text, compute_features, is_kanji
    text = book_text(os.path.join(LIBRARY, book['file']), book['format'])
    characters = len(TOKEN_CLEAN.sub('', text))
    if characters < 1000:
        return book['id'], None
    analysis = _analyzer.analyse(text)
    features = compute_features(analysis, _frequency)
    unique_kanji = len({c for c in text if is_kanji(c)})
    row = [features[name] for name in FEATURE_ORDER] + [math.log(characters), math.log(max(unique_kanji, 10))]
    model = float(_session.run(None, {'float_input': numpy.array([row], dtype=numpy.float32)})[0][0][0])
    score = round(min(max(model, 0.0), 5.0), 2)
    # 'adjusted' is kept for older readers; the model includes jiten.moe's adjustment.
    return book['id'], {
        'difficulty': score,
        'adjusted': score,
        'model': MODEL_VERSION,
        'characters': characters,
        'uniqueKanji': unique_kanji,
        'computedAt': int(time.time() * 1000),
    }


# ---------------------------------------------------------------------------
# Jobs

def run_in_pools(books, task, cancel: threading.Event):
    """Yields (book, result or exception), using fresh worker pools per chunk.
    Books lost when a worker process dies (e.g. out of memory) are retried one at a
    time, so only a book that kills a worker on its own is reported as failed."""
    for start in range(0, len(books), BOOKS_PER_POOL):
        lost = []
        yield from _run_pool(books[start:start + BOOKS_PER_POOL], task, cancel, WORKERS, lost)
        for book in lost:
            if cancel.is_set():
                return
            lost_again = []
            yield from _run_pool([book], task, cancel, 1, lost_again)
            if lost_again:
                yield book, RuntimeError('the worker process died on this book (out of memory?)')
        if cancel.is_set():
            return


def _run_pool(books, task, cancel: threading.Event, workers: int, lost: list):
    """Yields results of one pool; books whose worker died are added to `lost`."""
    with ProcessPoolExecutor(workers, initializer=_init_worker) as pool:
        futures = [pool.submit(task, book) for book in books]
        for book, future in zip(books, futures):
            if cancel.is_set():
                for f in futures:
                    f.cancel()
                return
            try:
                yield book, future.result()
            except BrokenProcessPool:
                lost.append(book)
            except Exception as error:
                yield book, error


def load_catalog():
    with open(CATALOG_PATH, encoding='utf-8') as f:
        # Manga (CBZ/ZIP) has no text to score.
        return [b for b in json.load(f)['books'] if b['format'] in ('EPUB', 'HTMLZ', 'TXT')]


def load_results():
    try:
        with open(RESULTS_PATH, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {'books': {}}


def save_results(results):
    tmp = RESULTS_PATH + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(results, f, separators=(',', ':'))
    os.replace(tmp, RESULTS_PATH)



class JobRunner:
    def __init__(self):
        self.lock = threading.Lock()
        self.job = None  # {'type', 'done', 'total', 'started', 'error'}
        self.cancel = threading.Event()

    def status(self):
        with self.lock:
            job = dict(self.job) if self.job else None
        results = load_results()
        return {
            'job': job,
            'dictionary': os.path.exists(FREQUENCY_DICTIONARY),
            'results': len(results.get('books', {})),
            'noText': len(results.get('noText', [])),
            'failed': len(results.get('failed', {})),
            'workers': WORKERS,
        }

    def start(self, job_type: str, target, *args):
        with self.lock:
            if self.job and not self.job.get('finished'):
                raise RuntimeError('Another job is running')
            self.cancel.clear()
            self.job = {'type': job_type, 'done': 0, 'total': 0, 'started': int(time.time() * 1000)}
        threading.Thread(target=self._run, args=(target, args), daemon=True).start()

    def _run(self, target, args):
        try:
            target(*args)
        except Exception as error:  # reported through status
            with self.lock:
                self.job['error'] = str(error)
        with self.lock:
            self.job['finished'] = int(time.time() * 1000)
            self.job['cancelled'] = self.cancel.is_set()

    def _progress(self, done=None, total=None):
        with self.lock:
            if done is not None:
                self.job['done'] = done
            if total is not None:
                self.job['total'] = total

    def compute(self, ids):
        if not os.path.exists(FREQUENCY_DICTIONARY):
            raise RuntimeError(f'Frequency dictionary missing: {FREQUENCY_DICTIONARY}')
        catalog = load_catalog()
        results = load_results()
        wanted = set(ids or ())
        # Books with too little text (image-only manga and scans) can't be estimated, and
        # failed ones are broken files (not a zip, no container.xml), retried once the file changes.
        no_text = set(results.get('noText', []))
        failed = results.setdefault('failed', {})
        # All books: only those not tried yet or estimated by another model, or whose file changed since it failed.
        # Selected books are always recomputed.
        books = [b for b in catalog if results['books'].get(str(b['id']), {}).get('model') != MODEL_VERSION
                 and b['id'] not in no_text
                 and failed.get(str(b['id']), {}).get('size') != b['size']] \
            if ids is None else [b for b in catalog if b['id'] in wanted]
        self._progress(0, len(books))
        last_save = time.monotonic()
        done = 0
        for book, result in run_in_pools(books, _estimate, self.cancel):
            if isinstance(result, Exception):
                print(f"compute: {book['file']}: {result}", file=sys.stderr)
                failed[str(book['id'])] = {'error': str(result)[:200], 'size': book['size']}
            elif result[1]:
                results['books'][str(result[0])] = result[1]
                no_text.discard(result[0])
                failed.pop(str(result[0]), None)
            else:
                no_text.add(result[0])
                failed.pop(str(result[0]), None)
            results['noText'] = sorted(no_text)
            done += 1
            self._progress(done)
            if time.monotonic() - last_save > 10:
                save_results(results)
                last_save = time.monotonic()
        save_results(results)


runner = JobRunner()


def import_results(source_dir: str):
    """Installs difficulty.json from offline.py after checking it."""
    import shutil
    import urllib.request

    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{PORT}/status', timeout=5) as response:
            job = json.load(response).get('job')
        if job and not job.get('finished'):
            sys.exit('A difficulty job is running on the server; import after it finishes or cancel it.')
    except OSError:
        pass  # service not running

    results = os.path.join(source_dir, 'difficulty.json')
    if not os.path.isfile(results):
        sys.exit(f'Missing {results} - run offline.py first')
    with open(results, encoding='utf-8') as f:
        books = json.load(f)['books']
    if not books:
        sys.exit('The results are empty')

    shutil.copyfile(results, RESULTS_PATH + '.import')
    os.replace(RESULTS_PATH + '.import', RESULTS_PATH)
    print(f'Imported {len(books)} estimates.')


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def _action(self):
        return self.path.rstrip('/').rsplit('/', 1)[-1]

    def do_GET(self):
        if self._action() == 'status':
            self._send(200, runner.status())
        else:
            self._send(404, {'error': 'not found'})

    def do_POST(self):
        try:
            length = max(int(self.headers.get('Content-Length') or 0), 0)
            body = json.loads(self.rfile.read(length) or b'{}')
        except ValueError:
            return self._send(400, {'error': 'invalid JSON'})
        action = self._action()
        try:
            if action == 'compute':
                ids = None if body.get('all') else [int(i) for i in body.get('ids', [])]
                if ids is not None and not ids:
                    return self._send(400, {'error': 'no books given'})
                runner.start('compute', runner.compute, ids)
            elif action == 'cancel':
                runner.cancel.set()
            else:
                return self._send(404, {'error': 'not found'})
        except RuntimeError as error:
            return self._send(409, {'error': str(error)})
        except (AttributeError, TypeError, ValueError):
            return self._send(400, {'error': 'invalid request'})
        self._send(202, runner.status())

    def log_message(self, *args):
        pass


def main(argv):
    os.makedirs(STATE_DIR, exist_ok=True)
    command = argv[1] if len(argv) > 1 else 'serve'
    if command == 'serve':
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    elif command == 'compute':
        runner.job = {'type': 'compute'}
        runner.compute([int(i) for i in argv[2:]] or None)
    elif command == 'import' and len(argv) == 3:
        import_results(argv[2])
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main(sys.argv)
