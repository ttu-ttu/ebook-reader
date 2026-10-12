"""Tests for assign-series.py (the planning part; no Calibre needed). Run from the repo root:
python3 -m unittest discover -s scripts/calibre/tests
"""
import importlib.machinery
import importlib.util
import os
import unittest

path = os.path.join(os.path.dirname(__file__), '..', 'assign-series.py')
spec = importlib.util.spec_from_loader('assign_series', importlib.machinery.SourceFileLoader('assign_series', path))
assign = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assign)


def book(book_id, title, series='', authors=('Unknown',)):
    return {'id': book_id, 'title': title, 'series': series, 'authors': list(authors)}


class PlanTest(unittest.TestCase):
    def test_joins_existing_series_written_differently(self):
        changes, _ = assign.plan([
            book(1, '無職転生 ～異世界行ったら本気だす～ 1', '無職転生 ～異世界行ったら本気だす～'),
            book(2, '無職転生 ～異世界行ったら本気だす～ 2 (MFブックス)'),
        ])
        self.assertEqual(changes, {2: ('無職転生 ～異世界行ったら本気だす～', 2.0)})

    def test_new_series_named_as_written(self):
        changes, _ = assign.plan([book(1, 'ダンタリアンの書架１'), book(2, 'ダンタリアンの書架２')])
        self.assertEqual(changes, {1: ('ダンタリアンの書架', 1.0), 2: ('ダンタリアンの書架', 2.0)})

    def test_leaves_single_volumes_and_books_with_a_series(self):
        changes, _ = assign.plan([
            book(1, '吾輩は猫である'),
            book(2, '一冊だけの本 3'),
            book(3, '物語 1', '別のシリーズ'),
            book(4, '物語 2', '別のシリーズ'),
        ])
        self.assertEqual(changes, {})

    def test_warns_about_the_same_volume_twice(self):
        _, warnings = assign.plan([book(1, '本の名前 1'), book(2, '本の名前 1'), book(3, '本の名前 2')])
        self.assertEqual(warnings, ['本の名前 1: several books (1, 2)'])

    def test_copies_of_one_volume_are_not_a_series(self):
        changes, _ = assign.plan([book(1, '日本の教養365'), book(2, '日本の教養365')])
        self.assertEqual(changes, {})

    def test_different_authors_are_not_grouped(self):
        changes, warnings = assign.plan([
            book(1, '西遊記 上', authors=['呉 承恩']),
            book(2, '西遊記 3', authors=['中野 美代子']),
        ])
        self.assertEqual(changes, {})
        self.assertIn('other author', warnings[0])

    def test_leaves_out_a_book_by_another_author(self):
        changes, warnings = assign.plan([
            book(1, '料理道 1', authors=['EDA']), book(2, '料理道 2', authors=['EDA', 'こちも']),
            book(3, '料理道 3'), book(4, '料理道 1', authors=['まいん']),
        ])
        self.assertEqual(sorted(changes), [1, 2, 3])
        self.assertEqual(warnings, ['料理道: left out 4 (other author)'])

    def test_another_author_stays_out_of_an_existing_series(self):
        changes, warnings = assign.plan([
            book(1, '料理道 1', '料理道', authors=['EDA']), book(2, '料理道 3', '料理道', authors=['EDA']),
            book(3, '料理道 2', authors=['まいん']), book(4, '料理道 4', authors=['EDA']),
        ])
        self.assertEqual(changes, {4: ('料理道', 4.0)})
        self.assertEqual(warnings, ['料理道: left out 3 (other author)'])

    def test_author_spellings(self):
        self.assertEqual(assign.other_authors([['伏見つかさ'], ['伏見 つかさ'], ['伏見　つかさ']]), [])
        self.assertEqual(assign.other_authors([['白石 定規'], ['定規'], ['白石定規', 'あずーる']]), [])
        self.assertEqual(assign.other_authors([['塚原洋一/臼井儀人'], ['臼井儀人；塚原洋一'], ['河合']]), [2])
        # Writer and illustrators tied: the writer alone still matches.
        self.assertEqual(assign.other_authors([['三萩せんや/jaguchi'], ['三萩せんや/jaguchi'], ['三萩せんや']]), [])

    def test_two_part_works(self):
        changes, _ = assign.plan([book(1, '銃口 上'), book(2, '銃口 下')])
        self.assertEqual(changes, {1: ('銃口', 1.0), 2: ('銃口', 2.0)})
        changes, _ = assign.plan([book(1, '終物語 上'), book(2, '終物語 中'), book(3, '終物語 下')])
        self.assertEqual(changes[3], ('終物語', 3))

    def test_written_name_keeps_full_width_characters(self):
        self.assertEqual(assign.written_name('［作者］ 魔法 ～副題～ ３', '魔法 ~副題~'), '魔法 ～副題～')


if __name__ == '__main__':
    unittest.main()
