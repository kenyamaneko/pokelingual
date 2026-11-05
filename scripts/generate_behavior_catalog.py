#!/usr/bin/env python3
"""テスト実行結果の JUnit XML から、テスト観点カタログを生成する。

テストの命名規約 (keyandnotes-rules testing.md「テストの命名」) に従ったテスト名を、
グループ (機能の階層) とケース (シナリオ) の階層に復元し、Markdown または HTML で
標準出力に書き出す。複数の JUnit XML のケースを 1 つのカタログにまとめ、トップレベルの
describe 名のタグ (区分・大機能・中機能) を上位の見出しにする。
"""

import argparse
import html
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field, replace
from pathlib import Path

# テストランナーが describe 連鎖とテスト名を連結する区切り。Vitest は " > "、Playwright は " › "
NAME_SEPARATORS = (" > ", " › ")

# skip されたテストは実行されておらず「テスト済み」と言えないため、注記を付けて区別する
SKIPPED_NOTE = "（skip 中のため未検証）"

# トップレベル describe 名の先頭に付ける、カタログの上位グループ見出し用タグの記法
TOP_LEVEL_TAG_PATTERN = re.compile(r"^\s*\[([^\]]+)\]\s*")

# タグの無いトップレベル describe をまとめる見出し名
UNTAGGED_GROUP_LABEL = "その他"

# タグの中で区分・大機能・中機能を区切る文字
TAG_ITEM_SEPARATOR = ":"

# 最初の項目 (区分) に書ける値。カタログ上の並び順でもある
TAG_DIVISIONS = ("本体", "運用", "外部連携")

# タグの項目数の下限 (区分・大機能) と上限 (区分・大機能・中機能)
MIN_TAG_ITEMS = 2
MAX_TAG_ITEMS = 3

# テストの無い仕様はカタログに現れないため、「載っていない = 仕様がない」という誤読を防ぐ
DISCLAIMER = (
    "本カタログは自動テストのテスト名から生成した「テスト済みの観点」の一覧であり、"
    "仕様の全量ではない。テストの無い仕様はここに現れない。"
)

PAGE_TITLE = "pokelingual テスト観点カタログ"

MARKDOWN_INDENT = "  "


@dataclass(frozen=True)
class BehaviorCase:
    """1 件のテストケースが表す振る舞い。

    Args:
        group_chain: 機能の階層を表すグループ名の連鎖 (describe の入れ子)。
        case_name: シナリオを表すケースの名前。
        is_skipped: skip されて実行されていないケースかどうか。
    """

    group_chain: tuple[str, ...]
    case_name: str
    is_skipped: bool


@dataclass
class GroupNode:
    """グループ 1 階層分の入れ物。

    Args:
        subgroups: グループ名をキーとする下位グループ。
        cases: このグループ直下のケース。
    """

    subgroups: "dict[str, GroupNode]" = field(default_factory=dict)
    cases: list[BehaviorCase] = field(default_factory=list)


def split_test_name(raw_name: str) -> tuple[tuple[str, ...], str]:
    """JUnit の testcase 名をグループ連鎖とケースの名前に分割する。

    Args:
        raw_name: テストランナーが階層を区切り文字で連結した testcase 名。

    Returns:
        (グループ連鎖, ケースの名前)。区切りが無ければグループ連鎖は空。
    """
    segments = [raw_name]
    for separator in NAME_SEPARATORS:
        segments = [part for segment in segments for part in segment.split(separator)]
    return tuple(segments[:-1]), segments[-1]


def split_tag_items(tag: str) -> tuple[str, ...]:
    """タグを区分・大機能・中機能の項目に分ける。

    Args:
        tag: ``[`` ``]`` を外したタグ。``区分:大機能`` または ``区分:大機能:中機能`` の形。

    Returns:
        タグの項目。

    Raises:
        ValueError: 項目が空のとき、項目が 2 つ未満または 3 つを超えるとき、
            または最初の項目が 本体・運用・外部連携 のいずれでもないとき。
    """
    items = tuple(tag.split(TAG_ITEM_SEPARATOR))
    if not all(items):
        raise ValueError(f"タグの項目が空です: [{tag}]")
    if not MIN_TAG_ITEMS <= len(items) <= MAX_TAG_ITEMS:
        raise ValueError(
            f"タグは区分と大機能を必須とし、項目は {MIN_TAG_ITEMS} つから {MAX_TAG_ITEMS} つまでです: [{tag}]"
        )
    if items[0] not in TAG_DIVISIONS:
        raise ValueError(
            f"タグの最初の項目は {'・'.join(TAG_DIVISIONS)} のいずれかにしてください: [{tag}]"
        )
    return items


def extract_top_level_tag(chain: tuple[str, ...]) -> tuple[str, ...]:
    """グループ連鎖の先頭 (トップレベル describe) からタグを抽出し、連鎖の先頭に挿入する。

    タグが ``[区分:大機能:中機能]`` のように ``:`` で区切られているときは、項目ごとに 1 段ずつ
    挿入する。

    Args:
        chain: split_test_name が返すグループ連鎖。

    Returns:
        タグの項目 (タグが無ければ UNTAGGED_GROUP_LABEL) を先頭に追加し、トップレベル要素から
        タグを除いた連鎖。連鎖が空ならそのまま返す。

    Raises:
        ValueError: タグが split_tag_items の条件を満たさないとき。
    """
    if not chain:
        return chain
    top, *rest = chain
    match = TOP_LEVEL_TAG_PATTERN.match(top)
    if match is None:
        return (UNTAGGED_GROUP_LABEL, top, *rest)
    return (*split_tag_items(match.group(1)), top[match.end() :], *rest)


def parse_junit_file(path: Path) -> list[BehaviorCase]:
    """JUnit XML を読み、全 testcase を BehaviorCase の列に変換する。

    Args:
        path: JUnit XML ファイルのパス。

    Returns:
        文書順の BehaviorCase のリスト。

    Raises:
        ValueError: testcase に name 属性が無いとき。
    """
    root = ET.parse(path).getroot()
    cases = []
    for testcase in root.iter("testcase"):
        raw_name = testcase.get("name")
        if raw_name is None:
            raise ValueError(f"testcase に name 属性がありません: {path}")
        group_chain, case_name = split_test_name(raw_name)
        is_skipped = testcase.find("skipped") is not None
        cases.append(BehaviorCase(group_chain, case_name, is_skipped))
    return cases


def build_catalog(paths: list[Path]) -> GroupNode:
    """JUnit XML 群のケースを 1 つのグループ木にまとめる。

    Args:
        paths: JUnit XML のパスのリスト。

    Returns:
        ルートの GroupNode。各ケースのトップレベル describe のタグは、区分・大機能・中機能の
        見出しになっている。

    Raises:
        ValueError: タグが split_tag_items の条件を満たさないとき。
    """
    cases = [case for path in paths for case in parse_junit_file(path)]
    return build_group_tree(
        [replace(case, group_chain=extract_top_level_tag(case.group_chain)) for case in cases]
    )


def build_group_tree(cases: list[BehaviorCase]) -> GroupNode:
    """ケース列をグループ連鎖に沿った木に組み上げる。

    Args:
        cases: 振る舞いのリスト。

    Returns:
        ルートの GroupNode。同名グループは 1 つのノードに統合される。
    """
    root = GroupNode()
    for case in cases:
        node = root
        for group_name in case.group_chain:
            node = node.subgroups.setdefault(group_name, GroupNode())
        node.cases.append(case)
    return root


def count_cases(node: GroupNode) -> int:
    """木に含まれるケースの総数を返す。

    Args:
        node: 数え上げの起点となる GroupNode。

    Returns:
        起点以下の全ケース数。
    """
    return len(node.cases) + sum(count_cases(sub) for sub in node.subgroups.values())


def tag_sort_key(tag: str) -> tuple[int, str]:
    """区分の見出しの並び順を決めるキー。本体・運用・外部連携の順に並べ、UNTAGGED_GROUP_LABEL は最後に置く。

    Args:
        tag: 比較対象の区分名。

    Returns:
        (TAG_DIVISIONS での位置、TAG_DIVISIONS に無ければ末尾の位置, 区分名) のタプル。
    """
    return (TAG_DIVISIONS.index(tag) if tag in TAG_DIVISIONS else len(TAG_DIVISIONS), tag)


def escape_text(text: str) -> str:
    """テスト名を Markdown / HTML のどちらでもタグと誤解釈されない形にする。

    Args:
        text: テスト名などの表示テキスト。

    Returns:
        `&` `<` `>` を実体参照にしたテキスト。
    """
    return html.escape(text, quote=False)


def format_case_text(case: BehaviorCase) -> str:
    """ケース 1 件の表示テキストを組み立てる。

    Args:
        case: 表示する振る舞い。

    Returns:
        エスケープ済みケースの名前。skip 中なら未検証の注記付き。
    """
    text = escape_text(case.case_name)
    if case.is_skipped:
        text += SKIPPED_NOTE
    return text


def append_group_markdown(lines: list[str], node: GroupNode, depth: int) -> None:
    """グループ内のケースと下位グループを Markdown の入れ子リストとして追記する。

    Args:
        lines: 追記先の行リスト。
        node: 描画するグループ。
        depth: リストの入れ子の深さ (0 起点)。
    """
    indent = MARKDOWN_INDENT * depth
    for case in node.cases:
        lines.append(f"{indent}- {format_case_text(case)}")
    for group_name in sorted(node.subgroups):
        subgroup = node.subgroups[group_name]
        lines.append(f"{indent}- **{escape_text(group_name)}**")
        append_group_markdown(lines, subgroup, depth + 1)


def render_markdown(root: GroupNode, commit: str | None) -> str:
    """テスト観点カタログを Markdown で描画する。

    Args:
        root: build_catalog が返したルートのグループ木。
        commit: 生成元 commit の SHA。None なら記載しない。

    Returns:
        Markdown 文書全体。
    """
    lines = [f"# {PAGE_TITLE}", "", f"> {DISCLAIMER}", ""]
    if commit is not None:
        lines += [f"生成元 commit: `{commit}`", ""]
    for case in root.cases:
        lines.append(f"- {format_case_text(case)}")
    if root.cases:
        lines.append("")
    for division in sorted(root.subgroups, key=tag_sort_key):
        subgroup = root.subgroups[division]
        lines += [f"## {escape_text(division)}（全 {count_cases(subgroup)} ケース）", ""]
        append_group_markdown(lines, subgroup, 0)
        lines.append("")
    return "\n".join(lines).rstrip("\n") + "\n"


def append_group_html(parts: list[str], node: GroupNode) -> None:
    """グループ内のケースと下位グループを HTML として追記する。

    ケースは <ul><li> で列挙し、下位グループは <details> としてケース数の注記付きで追記する。

    Args:
        parts: 追記先の HTML 断片リスト。
        node: 描画するグループ。
    """
    if node.cases:
        parts.append("<ul>")
        for case in node.cases:
            css_class = ' class="skipped"' if case.is_skipped else ""
            parts.append(f"<li{css_class}>{format_case_text(case)}</li>")
        parts.append("</ul>")
    for group_name in sorted(node.subgroups):
        subgroup = node.subgroups[group_name]
        # open 属性を付けず、ページが縦に長くなりすぎないよう既定で閉じた状態にする。
        parts.append(
            f"<details><summary>{escape_text(group_name)}"
            f"（全 {count_cases(subgroup)} ケース）</summary>"
        )
        append_group_html(parts, subgroup)
        parts.append("</details>")


def render_html(root: GroupNode, commit: str | None) -> str:
    """テスト観点カタログを単一ファイルの HTML ページとして描画する。

    Args:
        root: build_catalog が返したルートのグループ木。
        commit: 生成元 commit の SHA。None なら記載しない。

    Returns:
        HTML 文書全体。
    """
    parts = [
        "<!doctype html>",
        '<html lang="ja">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        f"<title>{PAGE_TITLE}</title>",
        "<style>",
        "body { font-family: sans-serif; max-width: 60rem; margin: 0 auto; padding: 1rem 1.5rem; line-height: 1.7; }",
        "blockquote { border-left: 4px solid #c9c9c9; margin: 1rem 0; padding: 0.25rem 1rem; background: #f6f6f6; }",
        "h2 { border-bottom: 2px solid #ddd; padding-bottom: 0.25rem; margin-top: 2.5rem; }",
        "details { margin: 0.25rem 0 0.25rem 1rem; }",
        "summary { cursor: pointer; font-weight: bold; }",
        "summary:hover { color: #1a5fb4; }",
        "li.skipped { color: #888; }",
        "</style>",
        "</head>",
        "<body>",
        f"<h1>{PAGE_TITLE}</h1>",
        f"<blockquote>{DISCLAIMER}</blockquote>",
    ]
    if commit is not None:
        parts.append(f"<p>生成元 commit: <code>{escape_text(commit)}</code></p>")
    if root.cases:
        parts.append("<ul>")
        for case in root.cases:
            css_class = ' class="skipped"' if case.is_skipped else ""
            parts.append(f"<li{css_class}>{format_case_text(case)}</li>")
        parts.append("</ul>")
    for division in sorted(root.subgroups, key=tag_sort_key):
        subgroup = root.subgroups[division]
        parts.append(f"<h2>{escape_text(division)}（全 {count_cases(subgroup)} ケース）</h2>")
        append_group_html(parts, subgroup)
    parts += ["</body>", "</html>"]
    return "\n".join(parts) + "\n"


def main(argv: list[str] | None = None) -> None:
    """コマンドライン引数を解釈し、カタログを標準出力へ書き出す。

    Args:
        argv: コマンドライン引数。None なら sys.argv を使う。
    """
    parser = argparse.ArgumentParser(description="JUnit XML からテスト観点カタログを生成する")
    parser.add_argument(
        "--junit",
        action="append",
        required=True,
        type=Path,
        metavar="PATH",
        help="JUnit XML のパス (複数指定可。全ケースを 1 つのカタログにまとめる)",
    )
    parser.add_argument("--format", choices=("markdown", "html"), required=True, help="出力形式")
    parser.add_argument("--commit", default=None, help="生成元 commit の SHA (省略可)")
    args = parser.parse_args(argv)

    root = build_catalog(args.junit)
    renderer = render_markdown if args.format == "markdown" else render_html
    sys.stdout.write(renderer(root, args.commit))


if __name__ == "__main__":
    main()
