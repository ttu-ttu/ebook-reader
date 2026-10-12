"""Tests for build-catalog.py. Run from the repo root:
python3 -m unittest discover -s scripts/calibre/tests
"""
import importlib.util
import io
import json
import os
import unittest
import zipfile

spec = importlib.util.spec_from_file_location(
    'build_catalog', os.path.join(os.path.dirname(__file__), '..', 'build-catalog.py'))
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)


class SplitVolumeTest(unittest.TestCase):
    def test_volume_numbers(self):
        cases = {
            'ダンタリアンの書架１': ('ダンタリアンの書架', 1.0),
            '魔法科高校の劣等生 (12)': ('魔法科高校の劣等生', 12.0),
            '物語 第三巻': ('物語', 3.0),
            '物語 下巻': ('物語', 3),
            'Some Title Vol. 4': ('Some Title', 4.0),
            '物語 2 【電子特別版】': ('物語', 2.0),
            '[作者] 物語 十二': ('物語', 12.0),
        }
        for title, expected in cases.items():
            with self.subTest(title=title):
                self.assertEqual(catalog.split_volume(title), expected)

    def test_publisher_label(self):
        self.assertEqual(catalog.split_volume('無職転生 ～異世界行ったら本気だす～ 2 (MFブックス)'),
                         ('無職転生 ~異世界行ったら本気だす~', 2.0))

    def test_no_volume(self):
        self.assertEqual(catalog.split_volume('吾輩は猫である'), ('吾輩は猫である', None))

    def test_kanji_number(self):
        self.assertEqual(catalog.kanji_number('二十三'), 23.0)
        self.assertEqual(catalog.kanji_number('百五'), 105.0)
        self.assertEqual(catalog.kanji_number('2.5'), 2.5)
        self.assertIsNone(catalog.kanji_number('上'))

    def test_series_name(self):
        self.assertTrue(catalog.is_series_name('物語'))
        self.assertFalse(catalog.is_series_name('b522apdm'))
        self.assertFalse(catalog.is_series_name('物'))


def make_epub(files: dict, opf: str) -> zipfile.ZipFile:
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w') as epub:
        epub.writestr('META-INF/container.xml', '''<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>''')
        epub.writestr('OEBPS/content.opf', opf)
        for name, content in files.items():
            epub.writestr(name, content)
    return zipfile.ZipFile(data)


OPF = '''<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
<metadata>{meta}</metadata>
<manifest>{items}</manifest>
<spine>{spine}</spine>
</package>'''


class CoverTest(unittest.TestCase):
    def test_cover_image_property(self):
        epub = make_epub({}, OPF.format(meta='', spine='', items='''
            <item id="a" href="images/a.jpg" media-type="image/jpeg"/>
            <item id="c" href="images/c.jpg" media-type="image/jpeg" properties="cover-image"/>'''))
        self.assertEqual(catalog.epub_cover_name(epub), 'OEBPS/images/c.jpg')

    def test_meta_cover(self):
        epub = make_epub({}, OPF.format(meta='<meta name="cover" content="b"/>', spine='', items='''
            <item id="a" href="a.png" media-type="image/png"/>
            <item id="b" href="b.png" media-type="image/png"/>'''))
        self.assertEqual(catalog.epub_cover_name(epub), 'OEBPS/b.png')

    def test_first_page_image(self):
        epub = make_epub(
            {'OEBPS/text/p1.xhtml': '<html><body><img src="../img/front.jpg"/></body></html>'},
            OPF.format(meta='', spine='<itemref idref="p1"/>', items='''
                <item id="p1" href="text/p1.xhtml" media-type="application/xhtml+xml"/>
                <item id="i" href="img/front.jpg" media-type="image/jpeg"/>
                <item id="z" href="img/zzz.jpg" media-type="image/jpeg"/>'''))
        self.assertEqual(catalog.epub_cover_name(epub), 'OEBPS/img/front.jpg')

    def test_jpeg_unchanged(self):
        data = catalog.JPEG_MAGIC + b'rest'
        self.assertIs(catalog.as_jpeg(data), data)


class MangaTest(unittest.TestCase):
    def archive(self, names):
        import tempfile
        path = os.path.join(tempfile.mkdtemp(), 'm.cbz')
        with zipfile.ZipFile(path, 'w') as archive:
            for name in names:
                archive.writestr(name, b'x')
        return path

    def test_pages_in_natural_order(self):
        path = self.archive(['10.jpg', '2.jpg', '1.png', '__MACOSX/._1.png', 'info.txt'])
        with zipfile.ZipFile(path) as archive:
            self.assertEqual(catalog.manga_pages(archive), ['1.png', '2.jpg', '10.jpg'])

    def test_only_image_archives_are_manga(self):
        self.assertTrue(catalog.is_valid_book(self.archive(['1.jpg', '2.jpg', 'a.txt']), 'ZIP'))
        self.assertFalse(catalog.is_valid_book(self.archive(['book.epub']), 'ZIP'))

    def test_onscripter_games_are_listed(self):
        game = self.archive(['Game/0.txt', 'Game/arc.nsa', 'Game/arc1.nsa'])
        self.assertTrue(catalog.is_valid_book(game, 'ZIP'))
        self.assertTrue(catalog.is_vn_file(game))
        self.assertFalse(catalog.is_vn_file(self.archive(['1.jpg'])))


class VnFolderTest(unittest.TestCase):
    def test_game_folders_are_listed_with_their_script_folder_and_cover(self):
        import tempfile
        vn_dir = tempfile.mkdtemp()
        for path in ('ノベル/0.txt', 'ノベル/cover.png', 'Nested/Game/nscript.dat', 'Empty/readme.txt'):
            os.makedirs(os.path.dirname(os.path.join(vn_dir, path)), exist_ok=True)
            open(os.path.join(vn_dir, path), 'w').close()
        games = {game['title']: game for game in catalog.vn_games(vn_dir)}
        self.assertEqual(sorted(games), ['Nested', 'ノベル'])
        self.assertEqual(games['ノベル']['file'], 'ノベル')
        self.assertEqual(games['ノベル']['cover'], 'ノベル/cover.png')
        self.assertEqual(games['Nested']['file'], 'Nested/Game')
        self.assertTrue(all(game['id'] < 0 and game['format'] == 'VN' for game in games.values()))


class BuildTest(unittest.TestCase):
    """A whole build from a minimal Calibre library."""

    def build(self, books):
        import sqlite3
        import tempfile
        library = tempfile.mkdtemp()
        db = sqlite3.connect(os.path.join(library, 'metadata.db'))
        db.executescript("""
            CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT, path TEXT, timestamp TEXT,
                                series_index REAL, pubdate TEXT);
            CREATE TABLE data (book INTEGER, format TEXT, name TEXT, uncompressed_size INTEGER);
            CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT);
            CREATE TABLE books_authors_link (book INTEGER, author INTEGER);
            CREATE TABLE series (id INTEGER PRIMARY KEY, name TEXT);
            CREATE TABLE books_series_link (book INTEGER, series INTEGER);
            CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT);
            CREATE TABLE books_tags_link (book INTEGER, tag INTEGER);
            CREATE TABLE ratings (id INTEGER PRIMARY KEY, rating INTEGER);
            CREATE TABLE books_ratings_link (book INTEGER, rating INTEGER);
            CREATE TABLE publishers (id INTEGER PRIMARY KEY, name TEXT);
            CREATE TABLE books_publishers_link (book INTEGER, publisher INTEGER);
        """)
        for book_id, title, series in books:
            os.makedirs(os.path.join(library, str(book_id)))
            with zipfile.ZipFile(os.path.join(library, str(book_id), 'b.epub'), 'w') as epub:
                epub.writestr('META-INF/container.xml', '<container/>')
            db.execute('INSERT INTO books VALUES (?, ?, ?, ?, 1, NULL)',
                       (book_id, title, str(book_id), '2026-01-01 00:00:00+00:00'))
            db.execute('INSERT INTO data VALUES (?, "EPUB", "b", 1)', (book_id,))
            if series:
                db.execute('INSERT OR IGNORE INTO series (name) VALUES (?)', (series,))
                db.execute('INSERT INTO books_series_link SELECT ?, id FROM series WHERE name = ?',
                           (book_id, series))
        db.commit()
        db.close()
        output = os.path.join(library, 'out', 'catalog.json')
        os.makedirs(os.path.dirname(output))
        catalog.main(library, output)
        with open(output, encoding='utf-8') as f:
            return {b['id']: (b['series'], b['seriesIndex']) for b in json.load(f)['books']}

    def test_inferred_volumes_join_a_calibre_series_written_differently(self):
        series = '無職転生 ～異世界行ったら本気だす～'
        result = self.build([
            (1, '無職転生 ～異世界行ったら本気だす～ 1 (MFブックス)', series),
            (2, '無職転生 ～異世界行ったら本気だす～ 2 (MFブックス)', None),
            (3, '別の本 1', None),
        ])
        self.assertEqual(result[1], (series, 1.0))
        self.assertEqual(result[2], (series, 2.0))
        # A single volume without a matching series stays on its own.
        self.assertEqual(result[3], ('', None))


if __name__ == '__main__':
    unittest.main()
