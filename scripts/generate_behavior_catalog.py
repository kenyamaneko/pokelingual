#!/usr/bin/env python3
"""テスト実行結果の JUnit XML から、テスト観点カタログを生成する。

テストの命名規約 (keyandnotes-rules testing.md「テストの命名」) に従ったテスト名を、
グループ (テスト対象の要素) とケース (シナリオ) の階層に復元し、Markdown または HTML で
標準出力に書き出す。セクションは「外から見た振る舞い」「内部の挙動」のカテゴリに属し、
1 つの JUnit XML をテストファイルのパスで複数セクションに振り分けることもできる。
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
        group_chain: テスト対象の要素を表すグループ名の連鎖 (describe の入れ子)。
        case_name: シナリオを表すケース名。
        is_skipped: skip されて実行されていないケースかどうか。
        source_file: テストランナーが記録した由来テストファイルのパス。
    """

    group_chain: tuple[str, ...]
    case_name: str
    is_skipped: bool
    source_file: str


@dataclass
class GroupNode:
    """グループ 1 階層分の入れ物。

    Args:
        subgroups: グループ名をキーとする下位グループ。
        cases: このグループ直下のケース。
    """

    subgroups: "dict[str, GroupNode]" = field(default_factory=dict)
    cases: list[BehaviorCase] = field(default_factory=list)


@dataclass(frozen=True)
class SectionSpec:
    """--section 引数 1 件分の指定。

    Args:
        category: セクションの上位カテゴリ名 (「外から見た振る舞い」「内部の挙動」等)。
        label: セクション名。
        path: JUnit XML のパス。
        prefixes: このセクションに含める由来ファイルパスの前方一致プレフィクス群。
            None なら JUnit XML 全体をこのセクションに含める。
    """

    category: str
    label: str
    path: Path
    prefixes: "tuple[str, ...] | None"


def split_test_name(raw_name: str) -> tuple[tuple[str, ...], str]:
    """JUnit の testcase 名をグループ連鎖とケース名に分割する。

    Args:
        raw_name: テストランナーが階層を区切り文字で連結した testcase 名。

    Returns:
        (グループ連鎖, ケース名)。区切りが無ければグループ連鎖は空。
    """
    segments = [raw_name]
    for separator in NAME_SEPARATORS:
        segments = [part for segment in segments for part in segment.split(separator)]
    return tuple(segments[:-1]), segments[-1]


def extract_top_level_tag(chain: tuple[str, ...]) -> tuple[str, ...]:
    """グループ連鎖の先頭 (トップレベル describe) からタグを抽出し、連鎖の先頭に挿入する。

    Args:
        chain: split_test_name が返すグループ連鎖。

    Returns:
        タグ (無ければ UNTAGGED_GROUP_LABEL) を先頭に追加し、トップレベル要素からタグを
        除いた連鎖。連鎖が空ならそのまま返す。
    """
    if not chain:
        return chain
    top, *rest = chain
    match = TOP_LEVEL_TAG_PATTERN.match(top)
    if match is None:
        return (UNTAGGED_GROUP_LABEL, top, *rest)
    return (match.group(1), top[match.end() :], *rest)


def apply_tag_grouping(cases: list[BehaviorCase]) -> list[BehaviorCase]:
    """各ケースのグループ連鎖に、トップレベル describe のタグ見出しを組み込む。

    Args:
        cases: 変換対象の BehaviorCase のリスト。

    Returns:
        extract_top_level_tag をグループ連鎖に適用した BehaviorCase のリスト。
    """
    return [replace(case, group_chain=extract_top_level_tag(case.group_chain)) for case in cases]


def parse_junit_file(path: Path) -> list[BehaviorCase]:
    """JUnit XML を読み、全 testcase を BehaviorCase の列に変換する。

    Args:
        path: JUnit XML ファイルのパス。

    Returns:
        文書順の BehaviorCase のリスト。

    Raises:
        ValueError: testcase に name または classname 属性が無いとき。
    """
    root = ET.parse(path).getroot()
    cases = []
    for testcase in root.iter("testcase"):
        raw_name = testcase.get("name")
        if raw_name is None:
            raise ValueError(f"testcase に name 属性がありません: {path}")
        source_file = testcase.get("classname")
        if source_file is None:
            raise ValueError(f"testcase に classname 属性がありません: {path}")
        group_chain, case_name = split_test_name(raw_name)
        is_skipped = testcase.find("skipped") is not None
        cases.append(BehaviorCase(group_chain, case_name, is_skipped, source_file))
    return cases


def route_cases_to_specs(
    specs: list[SectionSpec], cases: list[BehaviorCase]
) -> dict[SectionSpec, list[BehaviorCase]]:
    """1 つの JUnit XML から読んだケース群を、由来ファイルパスでセクションへ振り分ける。

    Args:
        specs: 同じ JUnit XML を参照する SectionSpec のリスト。
        cases: その JUnit XML から読んだ BehaviorCase のリスト。

    Returns:
        SectionSpec ごとに振り分けられた BehaviorCase のリスト。

    Raises:
        ValueError: プレフィクスにどのセクションにも、または複数セクションにマッチする
            ケースがあるとき。
    """
    if len(specs) == 1 and specs[0].prefixes is None:
        return {specs[0]: cases}

    assigned: dict[SectionSpec, list[BehaviorCase]] = {spec: [] for spec in specs}
    for case in cases:
        matches = [
            spec
            for spec in specs
            if spec.prefixes is not None
            and any(case.source_file.startswith(prefix) for prefix in spec.prefixes)
        ]
        if not matches:
            raise ValueError(f"どのセクションにも振り分けられない testcase です: {case.source_file}")
        if len(matches) > 1:
            raise ValueError(f"複数のセクションに振り分けられる testcase です: {case.source_file}")
        assigned[matches[0]].append(case)
    return assigned


def build_sections(specs: list[SectionSpec]) -> list[tuple[str, str, GroupNode]]:
    """--section 引数群から (カテゴリ, セクション名, グループ木) のリストを組み立てる。

    同じ JUnit XML を参照する SectionSpec は、由来ファイルパスのプレフィクスで振り分ける。
    出力は --section の指定順によらず、カテゴリの初出順にまとめる。

    Args:
        specs: コマンドラインで指定された SectionSpec のリスト。

    Returns:
        カテゴリごとにまとめた (カテゴリ, セクション名, グループ木) のリスト。
    """
    specs_by_path: dict[Path, list[SectionSpec]] = {}
    for spec in specs:
        specs_by_path.setdefault(spec.path, []).append(spec)

    assigned: dict[SectionSpec, list[BehaviorCase]] = {}
    for path, path_specs in specs_by_path.items():
        assigned.update(route_cases_to_specs(path_specs, parse_junit_file(path)))

    specs_by_category: dict[str, list[SectionSpec]] = {}
    for spec in specs:
        specs_by_category.setdefault(spec.category, []).append(spec)

    return [
        (spec.category, spec.label, build_group_tree(apply_tag_grouping(assigned[spec])))
        for category_specs in specs_by_category.values()
        for spec in category_specs
    ]


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


def tag_sort_key(tag: str) -> tuple[bool, str]:
    """タグ見出しの並び順を決めるキー。タグ名順、UNTAGGED_GROUP_LABEL は常に最後に置く。

    Args:
        tag: 比較対象のタグ名。

    Returns:
        (UNTAGGED_GROUP_LABEL かどうか, タグ名) のタプル。
    """
    return (tag == UNTAGGED_GROUP_LABEL, tag)


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
        エスケープ済みケース名。skip 中なら未検証の注記付き。
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


def render_markdown(sections: list[tuple[str, str, GroupNode]], commit: str | None) -> str:
    """テスト観点カタログを Markdown で描画する。

    Args:
        sections: (カテゴリ, セクション名, グループ木) のリスト。
        commit: 生成元 commit の SHA。None なら記載しない。

    Returns:
        Markdown 文書全体。
    """
    lines = [f"# {PAGE_TITLE}", "", f"> {DISCLAIMER}", ""]
    if commit is not None:
        lines += [f"生成元 commit: `{commit}`", ""]
    current_category = None
    for category, label, root in sections:
        if category != current_category:
            lines += [f"## {escape_text(category)}", ""]
            current_category = category
        lines += [f"### {escape_text(label)}（全 {count_cases(root)} ケース）", ""]
        for case in root.cases:
            lines.append(f"- {format_case_text(case)}")
        if root.cases:
            lines.append("")
        for group_name in sorted(root.subgroups, key=tag_sort_key):
            lines += [f"#### {escape_text(group_name)}", ""]
            append_group_markdown(lines, root.subgroups[group_name], 0)
            lines.append("")
    return "\n".join(lines).rstrip("\n") + "\n"


def append_group_html(parts: list[str], node: GroupNode, *, key=None) -> None:
    """グループ内のケースと下位グループを HTML として追記する。

    ケースは <ul><li> で列挙し、下位グループは <details> としてケース数の注記付きで追記する。

    Args:
        parts: 追記先の HTML 断片リスト。
        node: 描画するグループ。
        key: node 直下の下位グループを並べる際のソートキー。None なら名前順。
    """
    if node.cases:
        parts.append("<ul>")
        for case in node.cases:
            css_class = ' class="skipped"' if case.is_skipped else ""
            parts.append(f"<li{css_class}>{format_case_text(case)}</li>")
        parts.append("</ul>")
    for group_name in sorted(node.subgroups, key=key):
        subgroup = node.subgroups[group_name]
        # open 属性を付けず、ページが縦に長くなりすぎないよう既定で閉じた状態にする。
        parts.append(
            f"<details><summary>{escape_text(group_name)}"
            f"（全 {count_cases(subgroup)} ケース）</summary>"
        )
        append_group_html(parts, subgroup)
        parts.append("</details>")


def render_html(sections: list[tuple[str, str, GroupNode]], commit: str | None) -> str:
    """テスト観点カタログを単一ファイルの HTML ページとして描画する。

    Args:
        sections: (カテゴリ, セクション名, グループ木) のリスト。
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
        "h3 { margin-top: 1.75rem; }",
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
    current_category = None
    for category, label, root in sections:
        if category != current_category:
            parts.append(f"<h2>{escape_text(category)}</h2>")
            current_category = category
        parts.append(f"<h3>{escape_text(label)}（全 {count_cases(root)} ケース）</h3>")
        append_group_html(parts, root, key=tag_sort_key)
    parts += ["</body>", "</html>"]
    return "\n".join(parts) + "\n"


def parse_section_arg(value: str) -> SectionSpec:
    """--section の「カテゴリ:ラベル:パス[:プレフィクス]」形式を分解する。

    Args:
        value: コマンドラインで渡された値。

    Returns:
        分解済みの SectionSpec。

    Raises:
        argparse.ArgumentTypeError: 「カテゴリ:ラベル:パス」の形式でないとき。
    """
    parts = value.split(":", 3)
    if len(parts) < 3 or not all(parts[:3]):
        raise argparse.ArgumentTypeError(
            f"「カテゴリ:ラベル:パス」または「カテゴリ:ラベル:パス:プレフィクス」の形式で指定してください: {value!r}"
        )
    category, label, path = parts[0], parts[1], parts[2]
    prefixes = None
    if len(parts) == 4:
        prefixes = tuple(prefix for prefix in parts[3].split(",") if prefix)
        if not prefixes:
            raise argparse.ArgumentTypeError(f"プレフィクスが空です: {value!r}")
    return SectionSpec(category, label, Path(path), prefixes)


def main(argv: list[str] | None = None) -> None:
    """コマンドライン引数を解釈し、カタログを標準出力へ書き出す。

    Args:
        argv: コマンドライン引数。None なら sys.argv を使う。
    """
    parser = argparse.ArgumentParser(description="JUnit XML からテスト観点カタログを生成する")
    parser.add_argument(
        "--section",
        action="append",
        required=True,
        type=parse_section_arg,
        metavar="CATEGORY:LABEL:PATH[:PREFIXES]",
        help="カテゴリ名・セクション名・JUnit XML のパス・振り分けプレフィクス (複数指定可)",
    )
    parser.add_argument("--format", choices=("markdown", "html"), required=True, help="出力形式")
    parser.add_argument("--commit", default=None, help="生成元 commit の SHA (省略可)")
    args = parser.parse_args(argv)

    sections = build_sections(args.section)
    renderer = render_markdown if args.format == "markdown" else render_html
    sys.stdout.write(renderer(sections, args.commit))


if __name__ == "__main__":
    main()
