#!/usr/bin/env python3
"""Build a JSON catalog of importable books from a Calibre library.

The reader fetches this catalog to browse the library, then downloads the
book files themselves through nginx (see nginx-ebook-reader.conf.template).
EPUBs without a cover get one extracted from the book (manga: the first page)
into its library folder as cover.jpg, the file Calibre uses (metadata.db is not modified).
Usage: build-catalog.py LIBRARY_DIR OUTPUT_JSON
"""
import fcntl
import json
import os
import posixpath
import re
import sqlite3
import sys
import tempfile
import unicodedata
import urllib.request
import zipfile
import zlib
from collections import Counter, defaultdict
from datetime import datetime
from io import BytesIO
from urllib.parse import unquote
from xml.etree import ElementTree

try:
    from PIL import Image  # python3-pil, to turn PNG/GIF/WebP covers into JPEG
except ImportError:
    Image = None

# Formats the reader can import, in order of preference.
FORMATS = ['EPUB', 'HTMLZ', 'TXT', 'CBZ', 'ZIP']
# Image archives, read as manga. Many ZIPs in the library hold EPUBs instead; those are skipped.
MANGA_FORMATS = ('CBZ', 'ZIP')
PAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp')
# ONScripter scripts: a CBZ/ZIP holding one is a visual novel (lib/data/vn.ts in the app).
VN_SCRIPTS = ('0.txt', '00.txt', 'nscr_sec.dat', 'nscript.___', 'nscript.dat', 'onscript.nt2', 'onscript.nt3')


def added_ms(timestamp: str | None) -> int:
    """Calibre timestamp ('2026-09-12 13:45:12.123456+00:00') as epoch milliseconds."""
    try:
        return int(datetime.fromisoformat(timestamp).timestamp() * 1000)
    except (TypeError, ValueError):
        return 0


# Trailing edition labels such as 【電子特別版】 or (GA文庫), ignored when grouping series.
EDITION_LABEL = re.compile(
    r'[\s　]*[【\[(（〔][^】\])）〕]*(?:版|文庫|ノベル|ブックス|BOOKS|Books|特典|限定|特装|コミック)[^】\])）〕]*[】\])）〕]$'
)
AUTHOR_PREFIX = re.compile(r'^\[[^\]]+\]\s*')
KANJI_DIGITS = {'〇': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9}
VOLUME_WORDS = {'上': 1, '中': 2, '下': 3, '前編': 1, '後編': 2, '前': 1, '後': 2, '上巻': 1, '中巻': 2, '下巻': 3}
VOLUME_SUFFIXES = [
    re.compile(r'^(?P<base>.+?)[\s　]*(?:vol(?:ume)?\.?|#|＃)\s*(?P<num>\d+)\s*$', re.I),
    re.compile(r'^(?P<base>.+?)[\s　]*[(\[【]?\s*(?P<word>上巻|中巻|下巻|前編|後編|上|中|下)\s*[)\]】]?$'),
    re.compile(r'^(?P<base>.+?)[\s　]*[(\[【〈《]?\s*(?:第\s*)?(?P<num>\d+(?:\.\d+)?|[〇一二三四五六七八九十百]+)'
               r'\s*(?:巻|部|章|話|集|冊)?\s*[)\]】〉》]?$'),
]


def kanji_number(text: str) -> float | None:
    if text.replace('.', '', 1).isdigit():
        return float(text)
    if text == '十':
        return 10.0
    if all(c in KANJI_DIGITS or c in '十百' for c in text):
        total, current = 0, 0
        for char in text:
            if char == '百':
                total += (current or 1) * 100
                current = 0
            elif char == '十':
                total += (current or 1) * 10
                current = 0
            else:
                current = current * 10 + KANJI_DIGITS[char]
        return float(total + current)
    return None


def split_volume(title: str) -> tuple[str, float | None]:
    """'ダンタリアンの書架１' -> ('ダンタリアンの書架', 1.0). NFKC turns full-width and circled digits into ASCII."""
    text = AUTHOR_PREFIX.sub('', unicodedata.normalize('NFKC', title)).strip()
    text = EDITION_LABEL.sub('', text).strip()
    for pattern in VOLUME_SUFFIXES:
        match = pattern.match(text)
        if not match:
            continue
        base = match.group('base').strip(' 　-‐－:：・,、')
        number = VOLUME_WORDS[match.group('word')] if 'word' in match.groupdict() and match.group('word') \
            else kanji_number(match.group('num'))
        if base and number is not None:
            return base, number
    return text, None


def is_series_name(base: str) -> bool:
    """Skip product codes like 'b522apdm' and very short leftovers."""
    return len(base) >= 2 and not re.fullmatch(r'[0-9a-z_\-]+', base, re.I)


def manga_pages(archive: zipfile.ZipFile) -> list[str]:
    """Page images in reading order: natural sort, so '2.jpg' comes before '10.jpg'."""
    def key(name: str):
        return [int(part) if part.isdigit() else part.casefold() for part in re.split(r'(\d+)', name)]
    return sorted((name for name in archive.namelist()
                   if name.lower().endswith(PAGE_EXTENSIONS) and '__MACOSX/' not in name
                   and not posixpath.basename(name).startswith('.')), key=key)


def is_vn(archive: zipfile.ZipFile) -> bool:
    return any(posixpath.basename(name).lower() in VN_SCRIPTS for name in archive.namelist())


def is_vn_file(file_path: str) -> bool:
    try:
        with zipfile.ZipFile(file_path) as archive:
            return is_vn(archive)
    except (OSError, zipfile.BadZipFile):
        return False


VN_COVERS = ('cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp', 'icon.png', 'icon.jpg')


def vn_root(folder: str) -> str | None:
    """The folder holding a game's script: the game folder itself or one level down."""
    candidates = [folder] + sorted(entry.path for entry in os.scandir(folder)
                                   if entry.is_dir() and not entry.name.startswith('.'))
    for path in candidates:
        if any(name.lower() in VN_SCRIPTS for name in os.listdir(path)):
            return path
    return None


def vn_games(vn_dir: str) -> list[dict]:
    """Unpacked ONScripter games, one per folder of vn_dir, titled by the folder name.
    Ids are negative (from the name) so they never meet Calibre's."""
    games = []
    for entry in sorted(os.scandir(vn_dir), key=lambda e: e.name):
        if not entry.is_dir() or entry.name.startswith('.'):
            continue
        root = vn_root(entry.path)
        if not root:
            continue
        cover = next((name for name in os.listdir(entry.path) if name.lower() in VN_COVERS), '')
        games.append({
            'id': -(zlib.crc32(entry.name.encode()) & 0x7fffffff) or -1,
            'title': unicodedata.normalize('NFC', entry.name),
            'authors': '',
            'series': '',
            'seriesIndex': None,
            'seriesInferred': False,
            'tags': [],
            'rating': None,
            'publisher': '',
            'published': None,
            'added': int(entry.stat().st_mtime * 1000),
            'format': 'VN',
            'vn': True,
            'size': 0,
            'file': os.path.relpath(root, vn_dir),
            'cover': f'{entry.name}/{cover}' if cover else '',
        })
    return games


def vn_mtime(vn_dir: str) -> float:
    """Newest change to vn_dir's game folders (adding or removing a game or its files)."""
    times = [os.path.getmtime(vn_dir)]
    times += [entry.stat().st_mtime for entry in os.scandir(vn_dir) if entry.is_dir()]
    return max(times)


def is_valid_book(file_path: str, fmt: str) -> bool:
    """Skip missing files and non-zip EPUB/HTMLZ, e.g. macOS '._' resource forks,
    and CBZ/ZIP files that are neither mostly images nor an ONScripter game."""
    try:
        if fmt in MANGA_FORMATS:
            with zipfile.ZipFile(file_path) as archive:
                files = [name for name in archive.namelist() if not name.endswith('/')]
                if is_vn(archive):
                    return True
                return len(manga_pages(archive)) * 2 > len(files)
        with open(file_path, 'rb') as f:
            return fmt == 'TXT' or f.read(2) == b'PK'
    except (OSError, zipfile.BadZipFile):
        return False


MAX_COVER_BYTES = 20 * 1024 * 1024
FIRST_PAGES_TO_CHECK = 3
# Bump when cover detection improves, so books remembered as coverless are retried.
COVER_EXTRACTOR_VERSION = 3
JPEG_MAGIC = b'\xff\xd8\xff'
OPF_NS = '{http://www.idpf.org/2007/opf}'
CONTAINER_NS = '{urn:oasis:names:tc:opendocument:xmlns:container}'
IMAGE_SRC = re.compile(r'''(?:src|xlink:href|href)\s*=\s*["']([^"']+\.(?:jpe?g|png|gif|webp))["']''', re.I)


def epub_cover_name(epub: zipfile.ZipFile) -> str | None:
    """Like cover_candidate, but follows SVG/XHTML cover pages to the image they show."""
    name = cover_candidate(epub)
    if name and name.lower().endswith(('.svg', '.xhtml', '.html', '.htm')) and name in epub.namelist():
        match = IMAGE_SRC.search(epub.read(name).decode('utf-8', 'replace'))
        name = posixpath.normpath(posixpath.join(posixpath.dirname(name), unquote(match.group(1)))) \
            if match else None
    return name


def cover_candidate(epub: zipfile.ZipFile) -> str | None:
    """Zip entry of the cover image: the OPF's cover-image, its <meta name="cover">,
    the first image of the guide's cover page, an image item named like a cover,
    the first image on the first pages, or else the first image in the manifest."""
    if 'META-INF/container.xml' in epub.namelist():
        container = ElementTree.fromstring(epub.read('META-INF/container.xml'))
        opf_name = container.find(f'.//{CONTAINER_NS}rootfile').get('full-path')
    else:  # Some converters leave it out; the package file is still there.
        opf_name = next(name for name in epub.namelist() if name.lower().endswith('.opf'))
    opf = ElementTree.fromstring(epub.read(opf_name))

    def resolve(base: str, href: str) -> str:
        return posixpath.normpath(posixpath.join(posixpath.dirname(base), unquote(href.split('#')[0])))

    items = opf.findall(f'{OPF_NS}manifest/{OPF_NS}item')
    images = [item for item in items if (item.get('media-type') or '').startswith('image/')]

    for item in images:
        if 'cover-image' in (item.get('properties') or '').split():
            return resolve(opf_name, item.get('href'))

    meta = next((m for m in opf.iter(f'{OPF_NS}meta') if m.get('name') == 'cover'), None)
    if meta is not None:
        item = next((i for i in items if i.get('id') == meta.get('content')), None)
        if item is not None and (item.get('media-type') or '').startswith('image/'):
            return resolve(opf_name, item.get('href'))

    def first_image_on(page_name: str) -> str | None:
        if page_name not in epub.namelist():
            return None
        match = IMAGE_SRC.search(epub.read(page_name).decode('utf-8', 'replace'))
        return resolve(page_name, match.group(1)) if match else None

    reference = next((r for r in opf.iter(f'{OPF_NS}reference') if r.get('type') == 'cover'), None)
    if reference is not None:
        cover = first_image_on(resolve(opf_name, reference.get('href')))
        if cover:
            return cover

    for item in images:
        if 'cover' in (item.get('id', '') + item.get('href', '')).lower():
            return resolve(opf_name, item.get('href'))

    # Many Japanese EPUBs mark nothing, but open with a page showing the cover.
    hrefs = {item.get('id'): item.get('href') for item in items}
    spine = [hrefs.get(ref.get('idref')) for ref in opf.findall(f'{OPF_NS}spine/{OPF_NS}itemref')]
    for href in [href for href in spine if href][:FIRST_PAGES_TO_CHECK]:
        cover = first_image_on(resolve(opf_name, href))
        if cover:
            return cover

    return resolve(opf_name, images[0].get('href')) if images else None


def as_jpeg(data: bytes) -> bytes:
    """JPEG covers unchanged; other formats converted at full size and high quality."""
    if data.startswith(JPEG_MAGIC):
        return data
    if not Image:
        raise ValueError('not a JPEG and Pillow is missing')
    image = Image.open(BytesIO(data))
    if image.mode in ('RGBA', 'LA', 'P'):
        image = image.convert('RGBA')
        background = Image.new('RGB', image.size, 'white')
        background.paste(image, mask=image.getchannel('A'))
        image = background
    output = BytesIO()
    image.convert('RGB').save(output, 'JPEG', quality=95)
    return output.getvalue()


def add_epub_cover(epub_path: str, cover_path: str, manga: bool = False) -> bool:
    """Writes the EPUB's cover image (a manga's first page) to cover_path (never
    overwrites). False if it has none."""
    try:
        with zipfile.ZipFile(epub_path) as epub:
            name = (manga_pages(epub) or [None])[0] if manga else epub_cover_name(epub)
            if not name or epub.getinfo(name).file_size > MAX_COVER_BYTES:
                return False
            data = as_jpeg(epub.read(name))
    except Exception:  # noqa: BLE001 - a broken EPUB or image just means no cover
        return False

    tmp_path = cover_path + '.tmp'
    try:
        with open(tmp_path, 'wb') as f:
            f.write(data)
        if os.path.exists(cover_path):  # Calibre added one in the meantime
            os.remove(tmp_path)
        else:
            os.replace(tmp_path, cover_path)
    except OSError as error:
        # E.g. permissions or a full disk: skip this book, but don't stop the
        # catalog build or remember it as coverless, so the next run retries.
        print(f'Cannot write {cover_path}: {error}', file=sys.stderr)
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    return True


def add_missing_covers(library: str, books: dict, state_path: str) -> None:
    """Extracts covers for EPUBs and manga without cover.jpg. Books found to have none are
    remembered (with the EPUB's mtime) so they aren't opened again every run."""
    try:
        with open(state_path, encoding='utf-8') as f:
            state = json.load(f)
        no_cover = state['books'] if state.get('version') == COVER_EXTRACTOR_VERSION else {}
    except (OSError, json.JSONDecodeError, KeyError, AttributeError):
        no_cover = {}

    checked = {}
    for book in books.values():
        cover_path = os.path.join(library, os.path.dirname(book['file']), 'cover.jpg')
        manga = book['format'] in MANGA_FORMATS
        if (book['format'] != 'EPUB' and not manga) or os.path.exists(cover_path):
            continue
        epub_path = os.path.join(library, book['file'])
        epub_time = os.path.getmtime(epub_path)
        key = str(book['id'])
        if no_cover.get(key) == epub_time:
            checked[key] = epub_time
        elif not add_epub_cover(epub_path, cover_path, manga):
            checked[key] = epub_time

    tmp_state = state_path + '.tmp'
    with open(tmp_state, 'w', encoding='utf-8') as f:
        json.dump({'version': COVER_EXTRACTOR_VERSION, 'books': checked}, f)
    os.replace(tmp_state, state_path)


def main(library: str, output: str, vn_dir: str | None = None, force: bool = False) -> None:
    # The timer and the import queue (calibre-import) both build; one at a time.
    with open(output + '.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        build(library, output, vn_dir, force)


def build(library: str, output: str, vn_dir: str | None = None, force: bool = False) -> None:
    db_path = os.path.join(library, 'metadata.db')
    vn_dir = vn_dir if vn_dir and os.path.isdir(vn_dir) else None
    # Skip unless the library, the games or this script changed since the last build.
    # The output gets the inputs' time, not the time the build finished, so a book
    # added while a build ran is picked up by the next one.
    newest_input = max(os.path.getmtime(db_path), os.path.getmtime(__file__),
                       vn_mtime(vn_dir) if vn_dir else 0)
    if not force and os.path.exists(output) and os.path.getmtime(output) >= newest_input:
        return

    # Work on a copy so we don't block Calibre for the whole build. SQLite's backup takes
    # it under a read lock, so a write in progress (ours or Calibre's own) can't tear it.
    with tempfile.TemporaryDirectory() as tmp:
        conn = sqlite3.connect(os.path.join(tmp, 'metadata.db'))
        source = sqlite3.connect(f'file:{urllib.request.pathname2url(db_path)}?mode=ro', uri=True)
        try:
            source.backup(conn)
        finally:
            source.close()
        rows = conn.execute(
            f"""
            SELECT b.id, b.title, b.path, b.timestamp, d.name, d.format, d.uncompressed_size,
                   (SELECT group_concat(a.name, ' & ') FROM books_authors_link bal
                      JOIN authors a ON a.id = bal.author WHERE bal.book = b.id),
                   (SELECT s.name FROM books_series_link bsl
                      JOIN series s ON s.id = bsl.series WHERE bsl.book = b.id),
                   b.series_index,
                   (SELECT group_concat(t.name, char(31)) FROM books_tags_link btl
                      JOIN tags t ON t.id = btl.tag WHERE btl.book = b.id),
                   (SELECT r.rating FROM books_ratings_link brl
                      JOIN ratings r ON r.id = brl.rating WHERE brl.book = b.id),
                   (SELECT p.name FROM books_publishers_link bpl
                      JOIN publishers p ON p.id = bpl.publisher WHERE bpl.book = b.id),
                   b.pubdate
            FROM books b JOIN data d ON d.book = b.id
            WHERE d.format IN ({','.join('?' * len(FORMATS))})
            """,
            FORMATS,
        ).fetchall()
        conn.close()

    books = {}
    for (book_id, title, path, added, name, fmt, size, authors, series, series_index, tags, rating,
         publisher, pubdate) in rows:
        current = books.get(book_id)
        if current and FORMATS.index(current['format']) <= FORMATS.index(fmt):
            continue
        file = f'{path}/{name}.{fmt.lower()}'
        if not is_valid_book(os.path.join(library, file), fmt):
            continue
        books[book_id] = {
            'id': book_id,
            'title': title,
            'authors': authors or '',
            'series': series or '',
            'seriesIndex': series_index if series else None,
            'seriesInferred': False,
            'tags': sorted(tags.split('\x1f')) if tags else [],
            'rating': rating / 2 if rating else None,
            'publisher': publisher or '',
            'published': added_ms(pubdate) if pubdate and not pubdate.startswith('0101') else None,
            'added': added_ms(added),
            'format': fmt,
            'vn': fmt in MANGA_FORMATS and is_vn_file(os.path.join(library, file)),
            'size': size,
            'file': file,
            'cover': '',
        }

    add_missing_covers(library, books, os.path.join(os.path.dirname(output), 'no-cover.json'))
    for book in books.values():
        # The file is what matters; Calibre's has_cover flag is unset for extracted covers.
        cover = f"{os.path.dirname(book['file'])}/cover.jpg"
        if os.path.exists(os.path.join(library, cover)):
            book['cover'] = cover

    for game in vn_games(vn_dir) if vn_dir else []:
        books[game['id']] = game

    # Most books have no Calibre series, so group volumes by title ('...１', '...２').
    groups = defaultdict(list)
    for book in books.values():
        if not book['series']:
            base, number = split_volume(book['title'])
            if number is not None and is_series_name(base):
                groups[base].append((book, number))
    # A Calibre series written differently (～ vs ~, full-width digits) takes in the
    # matching volumes, even a single one, instead of becoming a second series.
    calibre_series = {unicodedata.normalize('NFKC', book['series']).casefold(): book['series']
                      for book in books.values() if book['series']}
    for base, members in groups.items():
        series = calibre_series.get(base.casefold())
        if not series and len(members) < 2:
            continue
        for book, number in members:
            book.update(series=series or base, seriesIndex=number, seriesInferred=True)

    # The reader identifies books by title, so make titles unique.
    title_counts = Counter(book['title'] for book in books.values())
    for book in books.values():
        if title_counts[book['title']] > 1 and book['authors']:
            book['title'] = f"{book['title']} ({book['authors']})"
    title_counts = Counter(book['title'] for book in books.values())
    for book in books.values():
        if title_counts[book['title']] > 1:
            book['title'] = f"{book['title']} [{book['id']}]"

    catalog = {'books': sorted(books.values(), key=lambda b: b['added'], reverse=True)}
    tmp_output = output + '.tmp'
    with open(tmp_output, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, separators=(',', ':'))
    os.utime(tmp_output, (newest_input, newest_input))
    os.replace(tmp_output, output)


if __name__ == '__main__':
    # build-calibre-catalog LIBRARY OUTPUT [VN_DIR] [--force]
    args = [arg for arg in sys.argv[1:] if arg != '--force']
    main(args[0], args[1], args[2] if len(args) > 2 else os.environ.get('VN_DIR', '/vn'),
         '--force' in sys.argv)
