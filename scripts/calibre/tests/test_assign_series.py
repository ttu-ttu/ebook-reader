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


def book(book_id, title, series='', authors=('Unknown',), index=1.0):
    return {'id': book_id, 'title': title, 'series': series, 'authors': list(authors), 'index': index}


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


class MergeTest(unittest.TestCase):
    def test_merges_series_written_differently_into_the_biggest(self):
        books = [
            book(1, 'ソードアート・オンライン1', 'ソードアート・オンライン', ['川原礫']),
            book(2, 'ソードアート・オンライン2', 'ソードアート・オンライン', ['川原礫']),
            book(3, 'ソードアートオンライン3', 'ソードアートオンライン', ['川原 礫']),
            book(4, 'ＳＡＯ', 'ＳＡＯ', ['川原礫']),
        ]
        renames, _, merges, _ = assign.merge_plan(books)
        self.assertEqual(renames, {3: 'ソードアート・オンライン'})
        self.assertEqual(merges, [{'to': 'ソードアート・オンライン', 'from': ['ソードアートオンライン'], 'books': 1}])

    def test_keeps_series_by_other_authors_apart(self):
        renames, _, merges, warnings = assign.merge_plan([
            book(1, 'A 1', 'Bleach', ['久保帯人']),
            book(2, 'B 1', 'BLEACH', ['松原真琴']),
        ])
        self.assertEqual((renames, merges), ({}, []))
        self.assertEqual(len(warnings), 1)

    def test_books_without_a_series_join_the_merged_name(self):
        renames, _, _, changes, _ = assign.full_plan([
            book(1, '物語 1', '物語', ['著者']),
            book(2, '物語 2', '物語', ['著者']),
            book(3, '物 語 3', '物 語', ['著者']),
            book(4, '物語 4', '', ['著者']),
        ])
        self.assertEqual(renames, {3: '物語'})
        self.assertEqual(changes, {4: ('物語', 4.0)})

    def test_punctuation_and_store_tags_dont_split_new_series(self):
        _, _, _, changes, _ = assign.full_plan([
            book(1, '【電子版限定特典付き】無限ガチャで『ざまぁ』します! 1', authors=['明鏡シスイ']),
            book(2, '【電子版限定特典付き】無限ガチャで『ざまぁ！』します！ 2', authors=['明鏡シスイ']),
            book(3, '無限ガチャで『ざまぁ！』します！ 3', authors=['明鏡シスイ']),
        ])
        self.assertEqual({name for name, _ in changes.values()}, {'無限ガチャで『ざまぁ！』します！'})
        self.assertEqual(sorted(number for _, number in changes.values()), [1.0, 2.0, 3.0])

    def test_series_holding_the_parts_of_each_volume_become_one(self):
        renames, indexes, merges, _ = assign.merge_plan([
            book(1, '第3話 前編', '十歳の最強魔導師 第3話', ['天乃聖樹'], 1.0),
            book(2, '第3話 後編', '十歳の最強魔導師 第3話', ['天乃聖樹'], 2.0),
            book(3, '第4話 前編', '十歳の最強魔導師 第4話', ['天乃聖樹'], 1.0),
            book(4, '6上', '魔女と傭兵 6', ['超法規的かえる'], 1.0),
            book(5, '6下', '魔女と傭兵6', ['超法規的かえる'], 3.0),
        ])
        self.assertEqual(renames, {1: '十歳の最強魔導師', 2: '十歳の最強魔導師', 3: '十歳の最強魔導師',
                                   4: '魔女と傭兵', 5: '魔女と傭兵'})
        self.assertEqual(indexes, {1: 3.1, 2: 3.2, 3: 4.1, 4: 6.1, 5: 6.3})
        self.assertEqual(len(merges), 2)

    def test_misnamed_main_series_joins_and_keeps_its_volumes(self):
        renames, indexes, _, _ = assign.merge_plan([
            book(1, 'a', '七つの魔剣が支配する', ['宇野朴人'], 1.0),
            book(2, 'b', '七つの魔剣が支配する', ['宇野朴人'], 2.0),
            book(3, 'c', '七つの魔剣が支配する　６', ['宇野朴人'], 6.0),
            book(4, 'd', '七つの魔剣が支配する　６', ['宇野朴人'], 7.0),
        ])
        self.assertEqual((renames, indexes), ({3: '七つの魔剣が支配する', 4: '七つの魔剣が支配する'}, {}))

    def test_sequel_series_stays_apart(self):
        renames, _, merges, _ = assign.merge_plan([
            book(1, 'a', 'はやて×ブレード', ['林家志弦'], 1.0),
            book(2, 'b', 'はやて×ブレード2', ['林家志弦'], 1.0),
            book(3, 'c', 'はやて×ブレード2', ['林家志弦'], 2.0),
        ])
        self.assertEqual((renames, merges), ({}, []))

    def test_leaves_lone_volume_like_names_and_kanji_parts(self):
        renames, _, merges, _ = assign.merge_plan([
            book(1, 'a', '魔法少女201'),
            book(2, 'b', '月が導く異世界道中', ['あずみ圭']),
            book(3, 'c', '月が導く異世界道中', ['あずみ圭']),
            book(4, 'd', 'はやて×ブレード2'),
        ])
        self.assertEqual((renames, merges), ({}, []))

    def test_lone_series_loses_its_store_tag(self):
        renames, _, _, _ = assign.merge_plan([
            book(1, 'a', '島崎奈々＠お仕事募集中【特典ペーパー付き】'),
            book(2, 'b', '【朗報】俺の許嫁になった地味子'),
            book(3, 'c', 'Occultic;Nine -オカルティック・ナイン-'),
        ])
        self.assertEqual(renames, {1: '島崎奈々＠お仕事募集中'})

    def test_spelling_found_in_titles_wins(self):
        renames, _, _, _ = assign.merge_plan([
            book(1, '蜘蛛ですが、なにか？ 1', '蜘蛛ですが, なにか'),
            book(2, '蜘蛛ですが、なにか？ 2', '蜘蛛ですが, なにか'),
            book(3, '蜘蛛ですが、なにか？ 3', '蜘蛛ですが、なにか？'),
        ])
        self.assertEqual(renames, {1: '蜘蛛ですが、なにか？', 2: '蜘蛛ですが、なにか？'})

    def test_shorter_spelling_does_not_win_by_being_a_substring(self):
        renames, _, _, _ = assign.merge_plan([
            book(1, '神は遊戯に飢えている。1', '神は遊戯に飢えている。'),
            book(2, '神は遊戯に飢えている。2', '神は遊戯に飢えている。'),
            book(3, '神は遊戯に飢えている。3', '神は遊戯に飢えている'),
            book(4, '神は遊戯に飢えている。4', '神は遊戯に飢えている'),
            book(5, '神は遊戯に飢えている。5', '神は遊戯に飢えている'),
        ])
        self.assertEqual(renames, {3: '神は遊戯に飢えている。', 4: '神は遊戯に飢えている。', 5: '神は遊戯に飢えている。'})
