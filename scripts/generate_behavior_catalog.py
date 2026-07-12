#!/usr/bin/env python3
"""テスト実行結果の JUnit XML から、テスト済みの振る舞いの一覧 (振る舞いカタログ) を生成する。

テストの命名規約 (keyandnotes-rules testing.md「テストの命名」) に従ったテスト名を、
グループ (テスト対象の要素) とケース (シナリオ) の階層に復元し、Markdown または HTML で
標準出力に書き出す。
"""

import argparse
import html
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

# テストランナーが describe 連鎖とテスト名を連結する区切り。Vitest は " > "、Playwright は " › "
NAME_SEPARATORS = (" > ", " › ")

# skip されたテストは実行されておらず「テスト済み」と言えないため、注記を付けて区別する
SKIPPED_NOTE = "（skip 中のため未検証）"

# テストの無い仕様はカタログに現れないため、「載っていない = 仕様がない」という誤読を防ぐ
DISCLAIMER = (
    "本カタログは自動テストのテスト名から生成した「テスト済みの振る舞い」の一覧であり、"
    "仕様の全量ではない。テストの無い仕様はここに現れない。"
)

PAGE_TITLE = "pokelingual 振る舞いカタログ"

MARKDOWN_INDENT = "  "


@dataclass(frozen=True)
class BehaviorCase:
    """1 件のテストケースが表す振る舞い。

    Args:
        group_chain: テスト対象の要素を表すグループ名の連鎖 (describe の入れ子)。
        case_name: シナリオを表すケース名。
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
    for group_name, subgroup in node.subgroups.items():
        lines.append(f"{indent}- **{escape_text(group_name)}**")
        append_group_markdown(lines, subgroup, depth + 1)


def render_markdown(sections: list[tuple[str, GroupNode]], commit: str | None) -> str:
    """振る舞いカタログを Markdown で描画する。

    Args:
        sections: (セクション名, グループ木) のリスト。
        commit: 生成元 commit の SHA。None なら記載しない。

    Returns:
        Markdown 文書全体。
    """
    lines = [f"# {PAGE_TITLE}", "", f"> {DISCLAIMER}", ""]
    if commit is not None:
        lines += [f"生成元 commit: `{commit}`", ""]
    for label, root in sections:
        lines += [f"## {escape_text(label)}（全 {count_cases(root)} ケース）", ""]
        for case in root.cases:
            lines.append(f"- {format_case_text(case)}")
        if root.cases:
            lines.append("")
        for group_name in sorted(root.subgroups):
            lines += [f"### {escape_text(group_name)}", ""]
            append_group_markdown(lines, root.subgroups[group_name], 0)
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


def render_html(sections: list[tuple[str, GroupNode]], commit: str | None) -> str:
    """振る舞いカタログを単一ファイルの HTML ページとして描画する。

    Args:
        sections: (セクション名, グループ木) のリスト。
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
    for label, root in sections:
        parts.append(f"<h2>{escape_text(label)}（全 {count_cases(root)} ケース）</h2>")
        append_group_html(parts, root)
    parts += ["</body>", "</html>"]
    return "\n".join(parts) + "\n"


def parse_section_arg(value: str) -> tuple[str, Path]:
    """--section の「ラベル:パス」形式を分解する。

    Args:
        value: コマンドラインで渡された「ラベル:パス」。

    Returns:
        (セクション名, JUnit XML のパス)。

    Raises:
        argparse.ArgumentTypeError: 「ラベル:パス」の形式でないとき。
    """
    label, colon, path = value.partition(":")
    if not colon or not label or not path:
        raise argparse.ArgumentTypeError(f"「ラベル:パス」の形式で指定してください: {value!r}")
    return label, Path(path)


def main(argv: list[str] | None = None) -> None:
    """コマンドライン引数を解釈し、カタログを標準出力へ書き出す。

    Args:
        argv: コマンドライン引数。None なら sys.argv を使う。
    """
    parser = argparse.ArgumentParser(description="JUnit XML から振る舞いカタログを生成する")
    parser.add_argument(
        "--section",
        action="append",
        required=True,
        type=parse_section_arg,
        metavar="LABEL:PATH",
        help="セクション名と JUnit XML のパス (複数指定可)",
    )
    parser.add_argument("--format", choices=("markdown", "html"), required=True, help="出力形式")
    parser.add_argument("--commit", default=None, help="生成元 commit の SHA (省略可)")
    args = parser.parse_args(argv)

    sections = [(label, build_group_tree(parse_junit_file(path))) for label, path in args.section]
    renderer = render_markdown if args.format == "markdown" else render_html
    sys.stdout.write(renderer(sections, args.commit))


if __name__ == "__main__":
    main()
