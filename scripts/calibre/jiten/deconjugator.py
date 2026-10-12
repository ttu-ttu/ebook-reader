"""Python port of Jiten's Deconjugator (Jiten.Parser/Deconjugator.cs, Apache-2.0).

Breadth-first application of the rules in deconjugator.json (originally from
rampaa/JL). Each result is a candidate dictionary form plus the chain of
conjugation steps ("process") that leads from it to the input text.
"""
import json
import os
import re
from functools import lru_cache
from typing import NamedTuple

MAX_TEXT_GROWTH = 10
MAX_CHAIN_DEPTH_ABOVE_INPUT = 6


class Form(NamedTuple):
    text: str
    original: str
    tags: tuple
    seen: frozenset
    process: tuple


class _VirtualRule(NamedTuple):
    dec_end: str
    con_end: str
    dec_tag: str | None
    con_tag: str | None
    detail: str


def _load_rules(path: str):
    with open(path, encoding='utf-8') as f:
        source = f.read()
    # The file has // comments and trailing commas, which json doesn't accept.
    source = re.sub(r'^\s*//.*$', '', source, flags=re.M)
    source = re.sub(r',(\s*[\]}])', r'\1', source)
    return json.loads(source)


class Deconjugator:
    def __init__(self, rules_path: str = os.path.join(os.path.dirname(__file__), 'deconjugator.json')):
        self.index: dict[str, list[tuple[dict, _VirtualRule, str]]] = {}
        self.max_con_end = 0

        for rule in _load_rules(rules_path):
            mode = rule['type']
            dec_tags = rule.get('dec_tag') or [None]
            con_tags = rule.get('con_tag') or [None]
            for i, dec_end in enumerate(rule['dec_end']):
                con_ends = rule['con_end']
                vr = _VirtualRule(
                    dec_end,
                    con_ends[i] if i < len(con_ends) else con_ends[0],
                    dec_tags[i] if i < len(dec_tags) else dec_tags[0],
                    con_tags[i] if i < len(con_tags) else con_tags[0],
                    rule['detail'],
                )
                self.max_con_end = max(self.max_con_end, len(vr.con_end))
                self.index.setdefault(vr.con_end, []).append((rule, vr, mode))

        # Results hold every intermediate form, so keep the cache small.
        self.deconjugate = lru_cache(maxsize=2000)(self._deconjugate)

    def _deconjugate(self, text: str) -> tuple[Form, ...]:
        if not text:
            return ()
        initial = Form(text, text, (), frozenset((text,)), ())
        seen = {initial}
        ordered = [initial]
        novel = [initial]

        while novel:
            new_novel = []
            for form in novel:
                if (
                    not form.text
                    or len(form.text) > len(form.original) + MAX_TEXT_GROWTH
                    or len(form.tags) > len(form.original) + MAX_CHAIN_DEPTH_ABOVE_INPUT
                ):
                    continue
                self._apply_rules(form, new_novel, seen, ordered)
            novel = new_novel

        # Longest text first, then ordinal, keeping discovery order for ties.
        return tuple(sorted(ordered, key=lambda f: (-len(f.text), f.text)))

    def _apply_rules(self, form: Form, new_novel: list, seen: set, ordered: list):
        text = form.text
        for suffix_len in range(min(self.max_con_end, len(text)) + 1):
            suffix = text[len(text) - suffix_len:]
            for rule, vr, mode in self.index.get(suffix, ()):
                if mode == 'onlyfinalrule' and form.tags:
                    continue
                if mode == 'neverfinalrule' and not form.tags:
                    continue
                if mode == 'rewriterule' and text != vr.con_end:
                    continue
                if mode == 'contextrule':
                    context = rule.get('contextrule')
                    if context == 'v1inftrap' and form.tags == ('stem-ren',):
                        continue
                    if context == 'saspecial':
                        prefix_length = len(text) - len(rule['con_end'][0])
                        if prefix_length > 0 and text[prefix_length - 1] == 'さ':
                            continue
                    if context == 'temirurule':
                        prefix = text[: len(text) - len(rule['con_end'][0])]
                        if not prefix.endswith(('て', 'で')):
                            continue

                if not rule['detail'] and not form.tags:
                    continue
                if form.tags and form.tags[-1] != vr.con_tag:
                    continue

                new_text = text[: len(text) - len(vr.con_end)] + vr.dec_end
                if new_text == form.original:
                    continue

                tags = form.tags
                if not tags and vr.con_tag:
                    tags = tags + (vr.con_tag,)
                if vr.dec_tag:
                    tags = tags + (vr.dec_tag,)
                new_form = Form(
                    new_text,
                    form.original,
                    tags,
                    form.seen | {new_text},
                    form.process + ((vr.detail,) if vr.detail else ()),
                )
                if new_form not in seen:
                    seen.add(new_form)
                    ordered.append(new_form)
                    new_novel.append(new_form)
