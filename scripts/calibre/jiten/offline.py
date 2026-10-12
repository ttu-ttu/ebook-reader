#!/usr/bin/env python3
"""Run the difficulty estimates on another (faster) computer.

Does exactly what Library → More → Difficulty estimates does on the server:
estimates every book without a current estimate, so an interrupted run resumes.
Reads the Calibre library over the network share, works in a local folder and
copies difficulty.json to the output folder at the end. Install it on the server
with `jiten-difficulty-import` (see README-offline.md).

  .venv/bin/python offline.py --library /mnt/media/Calibre --catalog http://<server>/calibre/catalog.json
      --out /mnt/media/ebook-reader-difficulty-import/output
"""
import argparse
import os
import shutil
import sys
import threading
import time
import urllib.request

DEFAULT_WORK_DIR = os.path.join(os.path.expanduser('~'), '.cache', 'ebook-reader-difficulty')


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--library', required=True, help='Calibre library folder (the one with metadata.db)')
    parser.add_argument('--out', required=True, help='Folder for difficulty.json')
    parser.add_argument('--work', default=DEFAULT_WORK_DIR,
                        help=f'Local working folder, not on a network share (default {DEFAULT_WORK_DIR})')
    parser.add_argument('--dictionary', default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                                             'jiten_freq_global.zip'),
                        help="Jiten's Yomitan frequency list (default: jiten_freq_global.zip in the drop folder)")
    parser.add_argument('--workers', type=int, default=max(1, (os.cpu_count() or 2) - 1),
                        help='Parallel processes; each needs about 0.5 GB of RAM (default: CPU cores - 1)')
    parser.add_argument('--catalog', required=True,
                        help="catalog.json file or URL, e.g. http://<server>/calibre/catalog.json")
    parser.add_argument('--limit', type=int, default=0,
                        help='Only estimate this many books, for a quick trial run')
    return parser.parse_args()


def check_setup(jiten_dir: str):
    """Fails early if this Python lacks the packages. Worker processes would
    otherwise die one after another, failing every book."""
    try:
        import numpy  # noqa: F401
        import onnxruntime  # noqa: F401
        sys.path.insert(0, jiten_dir)
        from features import Analyzer
        Analyzer()
    except ImportError as error:
        sys.exit(f'Missing Python package "{error.name}" for {sys.executable}.\n'
                 'Run offline.py with the virtual environment, after installing the packages:\n'
                 '  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt\n'
                 '  .venv/bin/python offline.py ...')


def copy_atomic(source: str, target: str):
    shutil.copyfile(source, target + '.tmp')
    os.replace(target + '.tmp', target)


def fetch_catalog(source: str, target: str):
    if source.startswith(('http://', 'https://')):
        with urllib.request.urlopen(source, timeout=60) as response, open(target, 'wb') as f:
            f.write(response.read())
    else:
        with open(source, 'rb') as src, open(target, 'wb') as f:
            f.write(src.read())


def report_progress(runner, stop: threading.Event):
    """Prints done/total, rate and time left every 30 seconds."""
    started = time.monotonic()
    while not stop.wait(30):
        job = runner.job or {}
        done, total = job.get('done', 0), job.get('total', 0)
        elapsed = time.monotonic() - started
        rate = done / elapsed if elapsed else 0
        left = (total - done) / rate if rate else 0
        print(f"  {job.get('type', '')}: {done}/{total} books, {rate:.1f}/s, "
              f"about {left / 60:.0f} min left", flush=True)


def run_step(runner, label: str, target, *args):
    print(f'{label}...', flush=True)
    runner.job = {'type': label, 'done': 0, 'total': 0}
    stop = threading.Event()
    reporter = threading.Thread(target=report_progress, args=(runner, stop), daemon=True)
    reporter.start()
    started = time.monotonic()
    try:
        target(*args)
    finally:
        stop.set()
    print(f'{label}: done in {(time.monotonic() - started) / 60:.1f} min', flush=True)


def main():
    args = parse_args()
    jiten_dir = os.path.dirname(os.path.abspath(__file__))
    out = os.path.abspath(args.out)
    work = os.path.abspath(args.work)

    if not os.path.isfile(os.path.join(args.library, 'metadata.db')):
        sys.exit(f'{args.library} is not a Calibre library (no metadata.db)')
    if not os.path.isfile(args.dictionary):
        sys.exit(f'{args.dictionary} not found: download Jiten\'s frequency list (jiten.moe/frequency-dictionaries)')

    print('Checking the setup...', flush=True)
    check_setup(jiten_dir)
    os.makedirs(out, exist_ok=True)
    os.makedirs(work, exist_ok=True)

    catalog = os.path.join(work, 'catalog.json')
    fetch_catalog(args.catalog, catalog)

    # service.py reads its paths from the environment when imported; worker
    # processes import it again and inherit these.
    os.environ.update({
        'CALIBRE_LIBRARY': os.path.abspath(args.library),
        'CALIBRE_CATALOG': catalog,
        'JITEN_STATE_DIR': work,
        'JITEN_WORKERS': str(args.workers),
        'JITEN_FREQUENCY_DICTIONARY': os.path.abspath(args.dictionary),
    })
    import service

    print(f'Library {args.library}, {args.workers} workers, working in {work}', flush=True)

    ids = [book['id'] for book in service.load_catalog()[:args.limit]] if args.limit else None
    run_step(service.runner, 'Difficulty estimates', service.runner.compute, ids)

    copy_atomic(service.RESULTS_PATH, os.path.join(out, os.path.basename(service.RESULTS_PATH)))

    results = service.load_results().get('books', {})
    print(f'\n{len(results)} books estimated. Copied difficulty.json to {out};\n'
          'install it on the server with jiten-difficulty-import.')


if __name__ == '__main__':
    main()
