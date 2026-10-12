#!/usr/bin/env python3
"""Puts Calibre books without a series into the series their title names, and
merges series whose names differ only in width, case, spaces or separators.

Run as the library owner, through Calibre's Python, e.g. in the import container,
or from the admin panel (Tools → Series, through the import service):

  docker compose exec import calibre-debug -e /app/assign-series.py -- [--apply] [--json]

Without --apply it only prints what it would change; --apply first copies
metadata.db to the import state folder (backups/, the last few kept). --json
prints the plan as JSON. Volume numbers are read
from titles like the catalog does (`split_volume` in build-catalog.py). A book
joins an existing Calibre series whose name matches its title's base (width and
case ignored, so ～ and ~ match); otherwise two or more books with the same base
form a new series, named as written in their titles. Books that already have a
series, or no volume number in the title, are left alone. Duplicate series are
merged into the variant with the most books, unless their authors differ. It takes the import
queue's lock (calibre-import), so it never writes while a book is being added.
Not part of upstream.
"""
import fcntl
import glob
import importlib.machinery
import json
import shutil
import time
import importlib.util
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

LIBRARY = os.environ.get('CALIBRE_LIBRARY', '/library')
WRITE_LOCK = os.environ.get('CALIBRE_WRITE_LOCK', '/data/state/import/calibre-write.lock')
BACKUP_DIR = os.environ.get('CALIBRE_BACKUP_DIR', '/data/state/import/backups')
KEEP_BACKUPS = 5
SEPARATORS = ' 　-‐－:：・,、'
PART_MIDDLE = re.compile(r'中(?:巻)?[\s)）】\]]*$')
PART_LAST = re.compile(r'下(?:巻)?[\s)）】\]]*$')


def load_catalog_module():
    here = os.path.dirname(os.path.abspath(__file__))
    for path in (os.path.join(here, 'build-catalog.py'), '/usr/local/bin/build-calibre-catalog'):
        if os.path.exists(path):
            spec = importlib.util.spec_from_loader('build_catalog', importlib.machinery.SourceFileLoader(
                'build_catalog', path))
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            return module
    sys.exit('build-catalog.py not found')


catalog = load_catalog_module()


def key(name: str) -> str:
    return unicodedata.normalize('NFKC', name).casefold()


def written_name(title: str, base: str) -> str:
    """The series name as written in the title (e.g. with ～), for the NFKC `base`."""
    # Drop an author prefix ([作者] or ［作者］): it is matched after NFKC, so find where it ends
    # in the original title.
    prefix = catalog.AUTHOR_PREFIX.match(unicodedata.normalize('NFKC', title))
    start = 0
    while prefix and len(unicodedata.normalize('NFKC', title[:start])) < prefix.end():
        start += 1
    text = title[start:]
    for end in range(len(text), 0, -1):
        candidate = text[:end].strip(SEPARATORS)
        if unicodedata.normalize('NFKC', candidate).strip(SEPARATORS) == base:
            return candidate
    return base


def author_keys(authors) -> set[str]:
    """Normalized names; one Calibre author can hold several ('塚原洋一/臼井儀人')."""
    names = set()
    for author in authors:
        if author != 'Unknown':
            for part in re.split(r'[/／;；:：,，・、]', unicodedata.normalize('NFKC', author)):
                if part := re.sub(r'\s+', '', part):
                    names.add(part)
    return names


def other_authors(author_lists) -> list[int]:
    """Indexes of books whose known authors don't include the group's main author,
    allowing for spacing and width, co-authors and shortened names (定規 for 白石定規)."""
    known = {i: author_keys(authors) for i, authors in enumerate(author_lists)}
    known = {i: names for i, names in known.items() if names}
    if len(known) < 2:
        return []
    counts = Counter(name for names in known.values() for name in names)
    top = counts.most_common(1)[0][0]
    # Names tied with the top one count too if credited together with it (writer and
    # illustrators on every volume), not two unrelated authors with one book each.
    main = [name for name, count in counts.items() if count == counts[top]
            and any(top in names and name in names for names in known.values())]
    related = lambda name: any(  # noqa: E731
        name == m or (len(name) >= 2 and (name in m or m in name)) for m in main)
    return [i for i, names in known.items() if not any(related(name) for name in names)]


def merge_key(name: str) -> str:
    return re.sub(r'[\s' + re.escape(SEPARATORS) + ']', '', key(name))


def authors_related(a: set[str], b: set[str]) -> bool:
    """Unknown authors don't keep series apart; shortened names (定規, 白石定規) match."""
    return not a or not b or any(
        x == y or (min(len(x), len(y)) >= 2 and (x in y or y in x)) for x in a for y in b)


def merge_plan(books):
    """Series written differently (width, case, spaces, separators) that share an author.
    Returns ({id: series}, [{'to', 'from', 'books'}], warnings)."""
    variants = defaultdict(lambda: defaultdict(list))
    for book in books:
        if book['series']:
            variants[merge_key(book['series'])][book['series']].append(book)

    renames, merges, warnings = {}, [], []
    for names in variants.values():
        if len(names) < 2:
            continue
        target = max(names, key=lambda name: (len(names[name]), name))
        authors = lambda members: set().union(*(author_keys(b['authors']) for b in members))  # noqa: E731
        target_authors = authors(names[target])
        merged = []
        for name, members in names.items():
            if name == target:
                continue
            if not authors_related(target_authors, authors(members)):
                warnings.append(f'{name}: kept apart from {target} (other author)')
                continue
            merged.append(name)
            renames.update({b['id']: target for b in members})
        if merged:
            merges.append({'to': target, 'from': sorted(merged),
                           'books': sum(len(names[name]) for name in merged)})
    return renames, merges, warnings


def plan(books):
    """books: dicts with id, title, series, authors. Returns ({id: (series, index)}, warnings)."""
    existing = {key(b['series']): b['series'] for b in books if b['series']}
    existing_authors = defaultdict(list)
    for b in books:
        if b['series']:
            existing_authors[key(b['series'])].append(b.get('authors', []))
    groups = defaultdict(list)
    for book in books:
        if book['series']:
            continue
        base, number = catalog.split_volume(book['title'])
        if number is not None and catalog.is_series_name(base):
            groups[key(base)].append((book, base, number))

    changes, warnings = {}, []
    for group_key, members in groups.items():
        series = existing.get(group_key)
        if not series and (len(members) < 2 or len({number for _, _, number in members}) < 2):
            # One book, or copies of the same volume: not a series.
            continue
        # Books by another author (e.g. a manga adaptation) stay out, also of an
        # existing series, whose books' authors count too.
        in_series = existing_authors.get(group_key, [])
        others = [i - len(in_series) for i in other_authors(in_series + [b.get('authors', []) for b, _, _ in members])
                  if i >= len(in_series)]
        if others:
            name = series or written_name(members[0][0]['title'], members[0][1])
            warnings.append(f'{name}: left out {", ".join(str(members[i][0]["id"]) for i in others)} (other author)')
            members = [m for i, m in enumerate(members) if i not in others]
            if not members or (not series and (len(members) < 2 or len({n for _, _, n in members}) < 2)):
                continue
        if not series:
            series = Counter(written_name(b['title'], base) for b, base, _ in members).most_common(1)[0][0]
        # 上/下 without a 中: 下 is the second volume, not the third.
        two_parts = not any(PART_MIDDLE.search(b['title']) for b, _, _ in members)
        for book, _, number in members:
            if two_parts and number == 3 and PART_LAST.search(book['title']):
                number = 2.0
            changes[book['id']] = (series, number)

    # The same volume twice in one series is usually a duplicate copy; worth a look.
    volumes = defaultdict(list)
    for book in books:
        if book['id'] in changes:
            volumes[changes[book['id']]].append(book['id'])
    for (series, number), ids in volumes.items():
        if len(ids) > 1:
            warnings.append(f'{series} {number:g}: several books ({", ".join(map(str, sorted(ids)))})')
    return changes, warnings


def backup(library: str) -> str:
    """Copies metadata.db to BACKUP_DIR, keeping the last KEEP_BACKUPS copies."""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    target = os.path.join(BACKUP_DIR, time.strftime('metadata-%Y%m%d-%H%M%S.db'))
    shutil.copy2(os.path.join(library, 'metadata.db'), target)
    for old in sorted(glob.glob(os.path.join(BACKUP_DIR, 'metadata-*.db')))[:-KEEP_BACKUPS]:
        os.remove(old)
    return target


def full_plan(books):
    """Merges first, so books without a series join the merged names."""
    renames, merges, warnings = merge_plan(books)
    merged = [{**b, 'series': renames.get(b['id'], b['series'])} for b in books]
    changes, more_warnings = plan(merged)
    return renames, merges, changes, warnings + more_warnings


def report(renames, merges, changes, warnings) -> dict:
    by_series = defaultdict(list)
    for name, number in changes.values():
        by_series[name].append(number)
    return {
        'assigned': len(changes),
        'series': [{'name': name, 'volumes': sorted(numbers)} for name, numbers in sorted(by_series.items())],
        'merged': len(renames),
        'merges': merges,
        'warnings': warnings,
    }


def main(argv):
    apply, as_json = '--apply' in argv, '--json' in argv
    from calibre.library import db  # calibre-debug provides it

    with open(WRITE_LOCK, 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        api = db(LIBRARY).new_api
        ids = api.all_book_ids()
        titles, series = api.all_field_for('title', ids), api.all_field_for('series', ids)
        authors = api.all_field_for('authors', ids)
        books = [{'id': i, 'title': titles[i], 'series': series[i] or '', 'authors': list(authors[i])}
                 for i in ids]
        renames, merges, changes, warnings = full_plan(books)
        result = report(renames, merges, changes, warnings)

        if apply and (changes or renames):
            result['backup'] = backup(LIBRARY)
            api.set_field('series', {**renames, **{i: name for i, (name, _) in changes.items()}})
            api.set_field('series_index', {i: number for i, (_, number) in changes.items()})
            result['written'] = True

        if as_json:
            print(json.dumps(result, ensure_ascii=False))
            return
        for merge in merges:
            print(f"{merge['to']}: merged {', '.join(merge['from'])} ({merge['books']} books)")
        for entry in result['series']:
            print(f"{entry['name']}: {len(entry['volumes'])} books, volumes "
                  f"{', '.join(f'{n:g}' for n in entry['volumes'])}")
        for warning in warnings:
            print(f'warning: {warning}')
        print(f"{len(changes)} books into {len(result['series'])} series, {len(renames)} books in merged series"
              + ('' if apply else ' (dry run; add --apply to write)'))
        if result.get('written'):
            print(f"written (backup: {result['backup']})")


if __name__ == '__main__':
    main(sys.argv[1:])
