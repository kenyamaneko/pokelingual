"""振る舞いカタログ生成 (generate_behavior_catalog.py) のテスト。"""

import argparse

import pytest

from generate_behavior_catalog import (
    SKIPPED_NOTE,
    BehaviorCase,
    GroupNode,
    build_group_tree,
    count_cases,
    main,
    parse_junit_file,
    parse_section_arg,
    render_html,
    render_markdown,
    split_test_name,
)


@pytest.mark.parametrize(
    ("raw_name", "expected_chain", "expected_case"),
    [
        pytest.param(
            "ケースX",
            (),
            "ケースX",
            id="区切りが無いとき、グループ連鎖は空で全体がケース名になる",
        ),
        pytest.param(
            "グループA > ケースX",
            ("グループA",),
            "ケースX",
            id="Vitest の区切り「 > 」が 1 つのとき、前半がグループ・後半がケース名になる",
        ),
        pytest.param(
            "グループA > グループB > ケースX",
            ("グループA", "グループB"),
            "ケースX",
            id="Vitest の区切りが 2 つのとき、先頭 2 要素が入れ子のグループ連鎖になる",
        ),
        pytest.param(
            "グループA › ケースX",
            ("グループA",),
            "ケースX",
            id="Playwright の区切り「 › 」でもグループとケース名に分割される",
        ),
        pytest.param(
            "a->b の変換",
            (),
            "a->b の変換",
            id="空白を伴わない > はケース名の一部として保持される",
        ),
    ],
)
def test_split_test_name(raw_name, expected_chain, expected_case):
    assert split_test_name(raw_name) == (expected_chain, expected_case)


def write_junit_xml(tmp_path, body):
    """testsuites で包んだ JUnit XML をテスト用に書き出す。

    Args:
        tmp_path: 書き出し先ディレクトリ。
        body: testsuites 要素の中身となる XML 断片。

    Returns:
        書き出したファイルのパス。
    """
    path = tmp_path / "junit.xml"
    path.write_text(f'<?xml version="1.0" encoding="UTF-8"?><testsuites>{body}</testsuites>', encoding="utf-8")
    return path


class TestParseJunitFile:
    def test_testcase_が_0_件のとき_空のリストを返す(self, tmp_path):
        path = write_junit_xml(tmp_path, '<testsuite name="dummy.test.ts"></testsuite>')
        assert parse_junit_file(path) == []

    def test_testcase_が複数件のとき_文書順の_BehaviorCase_になる(self, tmp_path):
        path = write_junit_xml(
            tmp_path,
            '<testsuite name="dummy.test.ts">'
            '<testcase name="グループA &gt; ケース1"/>'
            '<testcase name="グループA &gt; ケース2"/>'
            "</testsuite>",
        )
        assert parse_junit_file(path) == [
            BehaviorCase(("グループA",), "ケース1", is_skipped=False),
            BehaviorCase(("グループA",), "ケース2", is_skipped=False),
        ]

    def test_skipped_要素を持つ_testcase_は_is_skipped_が真になる(self, tmp_path):
        path = write_junit_xml(
            tmp_path,
            '<testsuite name="dummy.test.ts"><testcase name="ケースX"><skipped/></testcase></testsuite>',
        )
        assert parse_junit_file(path) == [BehaviorCase((), "ケースX", is_skipped=True)]

    def test_name_属性の無い_testcase_があるとき_ValueError_になる(self, tmp_path):
        path = write_junit_xml(tmp_path, '<testsuite name="dummy.test.ts"><testcase/></testsuite>')
        with pytest.raises(ValueError):
            parse_junit_file(path)


class TestBuildGroupTree:
    def test_同名グループのケースは_1_つのノードに統合される(self):
        tree = build_group_tree(
            [
                BehaviorCase(("グループA",), "ケース1", is_skipped=False),
                BehaviorCase(("グループA",), "ケース2", is_skipped=False),
            ]
        )
        assert list(tree.subgroups) == ["グループA"]
        assert [case.case_name for case in tree.subgroups["グループA"].cases] == ["ケース1", "ケース2"]

    def test_グループ連鎖が空のケースはルート直下に置かれる(self):
        tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=False)])
        assert [case.case_name for case in tree.cases] == ["ケースX"]
        assert tree.subgroups == {}

    def test_グループ連鎖が_2_段のとき_入れ子のノードになる(self):
        tree = build_group_tree([BehaviorCase(("グループA", "グループB"), "ケースX", is_skipped=False)])
        inner = tree.subgroups["グループA"].subgroups["グループB"]
        assert [case.case_name for case in inner.cases] == ["ケースX"]


class TestCountCases:
    def test_ケースが無い木では_0_になる(self):
        assert count_cases(GroupNode()) == 0

    def test_ルート直下_1_件のとき_1_になる(self):
        tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=False)])
        assert count_cases(tree) == 1

    def test_入れ子のグループを含めた総数になる(self):
        tree = build_group_tree(
            [
                BehaviorCase((), "ケース1", is_skipped=False),
                BehaviorCase(("グループA",), "ケース2", is_skipped=False),
                BehaviorCase(("グループA", "グループB"), "ケース3", is_skipped=False),
            ]
        )
        assert count_cases(tree) == 3


class TestRenderMarkdown:
    def test_射程の注意書きが引用として入る(self):
        output = render_markdown([], commit=None)
        disclaimer_line = next(
            line for line in output.splitlines() if "本カタログは自動テストのテスト名から生成した" in line
        )
        assert disclaimer_line.startswith("> ")

    def test_セクション見出しにケース総数が入る(self):
        tree = build_group_tree(
            [
                BehaviorCase(("グループA",), "ケース1", is_skipped=False),
                BehaviorCase(("グループA",), "ケース2", is_skipped=False),
            ]
        )
        output = render_markdown([("backend", tree)], commit=None)
        assert "## backend（全 2 ケース）" in output

    def test_グループは見出し_ケースは箇条書きとして現れる(self):
        tree = build_group_tree([BehaviorCase(("グループA",), "ケースX", is_skipped=False)])
        output = render_markdown([("backend", tree)], commit=None)
        assert "### グループA" in output
        assert "- ケースX" in output

    def test_入れ子のグループは太字の項目として_ケースが_1_段深い箇条書きになる(self):
        tree = build_group_tree([BehaviorCase(("グループA", "グループB"), "ケースX", is_skipped=False)])
        output = render_markdown([("backend", tree)], commit=None)
        assert "- **グループB**" in output
        assert "  - ケースX" in output

    def test_トップレベルのグループは入力順によらず名前順に並ぶ(self):
        tree = build_group_tree(
            [
                BehaviorCase(("グループB",), "ケース1", is_skipped=False),
                BehaviorCase(("グループA",), "ケース2", is_skipped=False),
            ]
        )
        output = render_markdown([("backend", tree)], commit=None)
        assert output.index("### グループA") < output.index("### グループB")

    def test_skip_中のケースには未検証の注記が付く(self):
        tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=True)])
        output = render_markdown([("backend", tree)], commit=None)
        assert f"- ケースX{SKIPPED_NOTE}" in output

    def test_ケース名の山括弧はタグと誤解釈されない形に変換される(self):
        tree = build_group_tree([BehaviorCase((), "<App /> を表示する", is_skipped=False)])
        output = render_markdown([("backend", tree)], commit=None)
        assert "&lt;App /&gt; を表示する" in output
        assert "<App />" not in output

    def test_commit_を渡すと生成元_commit_の行が入る(self):
        output = render_markdown([], commit="dummysha")
        assert "生成元 commit: `dummysha`" in output

    def test_commit_を渡さないと生成元_commit_の行は入らない(self):
        output = render_markdown([], commit=None)
        assert "生成元 commit" not in output


class TestRenderHtml:
    def test_日本語ページとして本文にケース名と注意書きが入る(self):
        tree = build_group_tree([BehaviorCase(("グループA",), "ケースX", is_skipped=False)])
        output = render_html([("backend", tree)], commit="dummysha")
        assert '<html lang="ja">' in output
        assert "<li>ケースX</li>" in output
        assert "本カタログは自動テストのテスト名から生成した" in output
        assert "<code>dummysha</code>" in output

    def test_skip_中のケースには未検証の注記とスタイル区分が付く(self):
        tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=True)])
        output = render_html([("backend", tree)], commit=None)
        assert f'<li class="skipped">ケースX{SKIPPED_NOTE}</li>' in output

    def test_ケース名の山括弧はタグと誤解釈されない形に変換される(self):
        tree = build_group_tree([BehaviorCase((), "<App /> を表示する", is_skipped=False)])
        output = render_html([("backend", tree)], commit=None)
        assert "&lt;App /&gt; を表示する" in output


class TestParseSectionArg:
    @pytest.mark.parametrize(
        ("value", "expected_label", "expected_path"),
        [
            pytest.param("backend:a/b.xml", "backend", "a/b.xml", id="「ラベル:パス」がラベルとパスに分かれる"),
            pytest.param("backend:a:b.xml", "backend", "a:b.xml", id="パスにコロンを含むとき、最初のコロンだけで分割される"),
        ],
    )
    def test_parse_section_arg(self, value, expected_label, expected_path):
        label, path = parse_section_arg(value)
        assert (label, str(path)) == (expected_label, expected_path)

    @pytest.mark.parametrize(
        "value",
        [
            pytest.param("backend", id="コロンが無いとき、形式エラーになる"),
            pytest.param(":a/b.xml", id="ラベルが空のとき、形式エラーになる"),
            pytest.param("backend:", id="パスが空のとき、形式エラーになる"),
        ],
    )
    def test_parse_section_arg_の形式エラー(self, value):
        with pytest.raises(argparse.ArgumentTypeError):
            parse_section_arg(value)


class TestMain:
    def test_JUnit_XML_を渡すと_Markdown_カタログが標準出力に出る(self, tmp_path, capsys):
        path = write_junit_xml(
            tmp_path,
            '<testsuite name="dummy.test.ts"><testcase name="グループA &gt; ケースX"/></testsuite>',
        )
        main(["--format", "markdown", "--section", f"backend:{path}", "--commit", "dummysha"])
        output = capsys.readouterr().out
        assert "# pokelingual 振る舞いカタログ" in output
        assert "## backend（全 1 ケース）" in output
        assert "- ケースX" in output
        assert "生成元 commit: `dummysha`" in output

    def test_存在しないパスを渡すとエラーで停止する(self, tmp_path):
        missing = tmp_path / "missing.xml"
        with pytest.raises(FileNotFoundError):
            main(["--format", "markdown", "--section", f"backend:{missing}"])
