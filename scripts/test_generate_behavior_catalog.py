"""テスト観点カタログ生成 (generate_behavior_catalog.py) のテスト。"""

import argparse

import pytest

from generate_behavior_catalog import (
    SKIPPED_NOTE,
    BehaviorCase,
    GroupNode,
    SectionSpec,
    build_group_tree,
    build_sections,
    count_cases,
    main,
    parse_junit_file,
    parse_section_arg,
    render_html,
    render_markdown,
    route_cases_to_specs,
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


def case_xml(name, classname="dummy.test.ts", skipped=False):
    """1 件の testcase 要素の XML 断片を組み立てる。

    Args:
        name: testcase の name 属性。
        classname: testcase の classname 属性。
        skipped: skipped 子要素を付けるかどうか。

    Returns:
        testcase 要素の XML 断片。
    """
    inner = "<skipped/>" if skipped else ""
    return f'<testcase classname="{classname}" name="{name}">{inner}</testcase>'


class TestParseJunitFile:
    def test_testcase_が_0_件のとき_空のリストを返す(self, tmp_path):
        path = write_junit_xml(tmp_path, '<testsuite name="dummy.test.ts"></testsuite>')
        assert parse_junit_file(path) == []

    def test_testcase_が複数件のとき_文書順の_BehaviorCase_になる(self, tmp_path):
        path = write_junit_xml(
            tmp_path,
            '<testsuite name="dummy.test.ts">'
            + case_xml("グループA &gt; ケース1")
            + case_xml("グループA &gt; ケース2")
            + "</testsuite>",
        )
        assert parse_junit_file(path) == [
            BehaviorCase(("グループA",), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
            BehaviorCase(("グループA",), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
        ]

    def test_skipped_要素を持つ_testcase_は_is_skipped_が真になる(self, tmp_path):
        path = write_junit_xml(
            tmp_path,
            '<testsuite name="dummy.test.ts">' + case_xml("ケースX", skipped=True) + "</testsuite>",
        )
        assert parse_junit_file(path) == [
            BehaviorCase((), "ケースX", is_skipped=True, source_file="dummy.test.ts")
        ]

    def test_classname_属性の値がそのまま_source_file_になる(self, tmp_path):
        path = write_junit_xml(
            tmp_path,
            '<testsuite name="dummy.test.ts">' + case_xml("ケースX", classname="src/router/router.test.ts") + "</testsuite>",
        )
        assert parse_junit_file(path)[0].source_file == "src/router/router.test.ts"

    def test_name_属性の無い_testcase_があるとき_ValueError_になる(self, tmp_path):
        path = write_junit_xml(tmp_path, '<testsuite name="dummy.test.ts"><testcase/></testsuite>')
        with pytest.raises(ValueError):
            parse_junit_file(path)

    def test_classname_属性の無い_testcase_があるとき_ValueError_になる(self, tmp_path):
        path = write_junit_xml(tmp_path, '<testsuite name="dummy.test.ts"><testcase name="ケースX"/></testsuite>')
        with pytest.raises(ValueError):
            parse_junit_file(path)


class TestBuildGroupTree:
    def test_同名グループのケースは_1_つのノードに統合される(self):
        tree = build_group_tree(
            [
                BehaviorCase(("グループA",), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
                BehaviorCase(("グループA",), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
            ]
        )
        assert list(tree.subgroups) == ["グループA"]
        assert [case.case_name for case in tree.subgroups["グループA"].cases] == ["ケース1", "ケース2"]

    def test_グループ連鎖が空のケースはルート直下に置かれる(self):
        tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=False, source_file="dummy.test.ts")])
        assert [case.case_name for case in tree.cases] == ["ケースX"]
        assert tree.subgroups == {}

    def test_グループ連鎖が_2_段のとき_入れ子のノードになる(self):
        tree = build_group_tree(
            [BehaviorCase(("グループA", "グループB"), "ケースX", is_skipped=False, source_file="dummy.test.ts")]
        )
        inner = tree.subgroups["グループA"].subgroups["グループB"]
        assert [case.case_name for case in inner.cases] == ["ケースX"]


class TestCountCases:
    def test_ケースが無い木では_0_になる(self):
        assert count_cases(GroupNode()) == 0

    def test_ルート直下_1_件のとき_1_になる(self):
        tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=False, source_file="dummy.test.ts")])
        assert count_cases(tree) == 1

    def test_入れ子のグループを含めた総数になる(self):
        tree = build_group_tree(
            [
                BehaviorCase((), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
                BehaviorCase(("グループA",), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
                BehaviorCase(("グループA", "グループB"), "ケース3", is_skipped=False, source_file="dummy.test.ts"),
            ]
        )
        assert count_cases(tree) == 3


class TestRouteCasesToSpecs:
    def test_プレフィクス指定の無いセクションが_1_件のとき_全ケースがそのセクションに入る(self):
        spec = SectionSpec("外から見た振る舞い", "frontend", "junit.xml", prefixes=None)
        cases = [BehaviorCase((), "ケースX", is_skipped=False, source_file="src/App.test.tsx")]
        assert route_cases_to_specs([spec], cases) == {spec: cases}

    def test_由来ファイルパスがプレフィクスに前方一致するとき_そのセクションに振り分けられる(self):
        router_spec = SectionSpec("外から見た振る舞い", "backend API の振る舞い", "junit.xml", prefixes=("src/router/",))
        domain_spec = SectionSpec("内部の挙動", "backend 内部部品の検証", "junit.xml", prefixes=("src/domain/",))
        router_case = BehaviorCase((), "ルーティングの検証", is_skipped=False, source_file="src/router/router.test.ts")
        domain_case = BehaviorCase((), "除外の判定", is_skipped=False, source_file="src/domain/exclusion.test.ts")

        result = route_cases_to_specs([router_spec, domain_spec], [router_case, domain_case])

        assert result[router_spec] == [router_case]
        assert result[domain_spec] == [domain_case]

    def test_どのプレフィクスにも前方一致しない由来ファイルパスがあるとき_ValueError_になる(self):
        router_spec = SectionSpec("外から見た振る舞い", "backend API の振る舞い", "junit.xml", prefixes=("src/router/",))
        unrouted_case = BehaviorCase((), "設定の検証", is_skipped=False, source_file="src/config/config.test.ts")

        with pytest.raises(ValueError):
            route_cases_to_specs([router_spec], [unrouted_case])

    def test_複数のプレフィクスに前方一致する由来ファイルパスがあるとき_ValueError_になる(self):
        outer_spec = SectionSpec("外から見た振る舞い", "セクションA", "junit.xml", prefixes=("src/",))
        inner_spec = SectionSpec("内部の挙動", "セクションB", "junit.xml", prefixes=("src/domain/",))
        ambiguous_case = BehaviorCase((), "除外の判定", is_skipped=False, source_file="src/domain/exclusion.test.ts")

        with pytest.raises(ValueError):
            route_cases_to_specs([outer_spec, inner_spec], [ambiguous_case])


class TestBuildSections:
    def test_同じ_JUnit_XML_を参照する複数セクションはプレフィクスで振り分けて組み上げる(self, tmp_path):
        path = write_junit_xml(
            tmp_path,
            '<testsuite name="dummy">'
            + case_xml("ケースA", classname="src/router/router.test.ts")
            + case_xml("ケースB", classname="src/domain/exclusion.test.ts")
            + "</testsuite>",
        )
        specs = [
            SectionSpec("外から見た振る舞い", "backend API の振る舞い", path, prefixes=("src/router/",)),
            SectionSpec("内部の挙動", "backend 内部部品の検証", path, prefixes=("src/domain/",)),
        ]

        sections = build_sections(specs)

        assert [(category, label) for category, label, _ in sections] == [
            ("外から見た振る舞い", "backend API の振る舞い"),
            ("内部の挙動", "backend 内部部品の検証"),
        ]
        assert [case.case_name for case in sections[0][2].cases] == ["ケースA"]
        assert [case.case_name for case in sections[1][2].cases] == ["ケースB"]

    def test_同じカテゴリのセクションは指定順が離れていてもカテゴリ単位にまとめられる(self, tmp_path):
        def write_at(filename):
            xml_path = tmp_path / filename
            xml_path.write_text(
                '<?xml version="1.0" encoding="UTF-8"?><testsuites>'
                f'<testsuite name="dummy">{case_xml("ケースX")}</testsuite></testsuites>',
                encoding="utf-8",
            )
            return xml_path

        specs = [
            SectionSpec("外から見た振る舞い", "backend", write_at("backend.xml"), prefixes=None),
            SectionSpec("内部の挙動", "backend 内部部品の検証", write_at("internal.xml"), prefixes=None),
            SectionSpec("外から見た振る舞い", "frontend", write_at("frontend.xml"), prefixes=None),
        ]

        sections = build_sections(specs)

        assert [(category, label) for category, label, _ in sections] == [
            ("外から見た振る舞い", "backend"),
            ("外から見た振る舞い", "frontend"),
            ("内部の挙動", "backend 内部部品の検証"),
        ]


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
                BehaviorCase(("グループA",), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
                BehaviorCase(("グループA",), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
            ]
        )
        output = render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)
        assert "### backend（全 2 ケース）" in output

    def test_同じカテゴリが連続するとき_カテゴリ見出しは_1_回だけ入る(self):
        tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=False, source_file="dummy.test.ts")])
        output = render_markdown(
            [
                ("外から見た振る舞い", "backend", tree),
                ("外から見た振る舞い", "frontend", tree),
            ],
            commit=None,
        )
        assert output.count("## 外から見た振る舞い") == 1

    def test_カテゴリが切り替わるとき_新しいカテゴリ見出しが入る(self):
        tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=False, source_file="dummy.test.ts")])
        output = render_markdown(
            [
                ("外から見た振る舞い", "backend API の振る舞い", tree),
                ("内部の挙動", "backend 内部部品の検証", tree),
            ],
            commit=None,
        )
        assert "## 外から見た振る舞い" in output
        assert "## 内部の挙動" in output
        assert output.index("## 外から見た振る舞い") < output.index("## 内部の挙動")

    def test_グループは見出し_ケースは箇条書きとして現れる(self):
        tree = build_group_tree([BehaviorCase(("グループA",), "ケースX", is_skipped=False, source_file="dummy.test.ts")])
        output = render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)
        assert "#### グループA" in output
        assert "- ケースX" in output

    def test_入れ子のグループは太字の項目として_ケースが_1_段深い箇条書きになる(self):
        tree = build_group_tree(
            [BehaviorCase(("グループA", "グループB"), "ケースX", is_skipped=False, source_file="dummy.test.ts")]
        )
        output = render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)
        assert "- **グループB**" in output
        assert "  - ケースX" in output

    def test_トップレベルのグループは入力順によらず名前順に並ぶ(self):
        tree = build_group_tree(
            [
                BehaviorCase(("グループB",), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
                BehaviorCase(("グループA",), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
            ]
        )
        output = render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)
        assert output.index("#### グループA") < output.index("#### グループB")

    def test_skip_中のケースには未検証の注記が付く(self):
        tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=True, source_file="dummy.test.ts")])
        output = render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)
        assert f"- ケースX{SKIPPED_NOTE}" in output

    def test_ケース名の山括弧はタグと誤解釈されない形に変換される(self):
        tree = build_group_tree([BehaviorCase((), "<App /> を表示する", is_skipped=False, source_file="dummy.test.ts")])
        output = render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)
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
        tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=False, source_file="dummy.test.ts")])
        output = render_html([("外から見た振る舞い", "backend", tree)], commit="dummysha")
        assert '<html lang="ja">' in output
        assert "<li>ケースX</li>" in output
        assert "本カタログは自動テストのテスト名から生成した" in output
        assert "<code>dummysha</code>" in output

    def test_カテゴリが切り替わるとき_新しいカテゴリ見出しが入る(self):
        tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=False, source_file="dummy.test.ts")])
        output = render_html(
            [
                ("外から見た振る舞い", "backend API の振る舞い", tree),
                ("内部の挙動", "backend 内部部品の検証", tree),
            ],
            commit=None,
        )
        assert "<h2>外から見た振る舞い</h2>" in output
        assert "<h2>内部の挙動</h2>" in output

    def test_グループは折りたたみ可能な_details_としてケース数の注記付きで現れる(self):
        tree = build_group_tree(
            [
                BehaviorCase(("グループA",), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
                BehaviorCase(("グループA",), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
            ]
        )
        output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
        assert "<details><summary>グループA（全 2 ケース）</summary>" in output
        assert "<li>ケース1</li>" in output
        assert "<li>ケース2</li>" in output

    def test_details_はケースの_ul_の外側に置かれる(self):
        tree = build_group_tree([BehaviorCase(("グループA",), "ケースX", is_skipped=False, source_file="dummy.test.ts")])
        output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
        assert "<ul><details>" not in output
        assert "<ul>\n<details>" not in output

    def test_入れ子のグループは_details_が入れ子になる(self):
        tree = build_group_tree(
            [BehaviorCase(("グループA", "グループB"), "ケースX", is_skipped=False, source_file="dummy.test.ts")]
        )
        output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
        outer_start = output.index("<details><summary>グループA")
        inner_start = output.index("<details><summary>グループB")
        inner_end = output.index("</details>", inner_start)
        outer_end = output.index("</details>", inner_end + 1)
        assert outer_start < inner_start < inner_end < outer_end

    def test_トップレベルのグループは入力順によらず名前順に並ぶ(self):
        tree = build_group_tree(
            [
                BehaviorCase(("グループB",), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
                BehaviorCase(("グループA",), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
            ]
        )
        output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
        assert output.index("グループA（全") < output.index("グループB（全")

    def test_skip_中のケースには未検証の注記とスタイル区分が付く(self):
        tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=True, source_file="dummy.test.ts")])
        output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
        assert f'<li class="skipped">ケースX{SKIPPED_NOTE}</li>' in output

    def test_ケース名の山括弧はタグと誤解釈されない形に変換される(self):
        tree = build_group_tree([BehaviorCase((), "<App /> を表示する", is_skipped=False, source_file="dummy.test.ts")])
        output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
        assert "&lt;App /&gt; を表示する" in output


class TestParseSectionArg:
    def test_カテゴリ_ラベル_パスの_3_要素が分かれる(self):
        spec = parse_section_arg("外から見た振る舞い:backend:a/b.xml")
        assert (spec.category, spec.label, str(spec.path), spec.prefixes) == (
            "外から見た振る舞い",
            "backend",
            "a/b.xml",
            None,
        )

    def test_プレフィクスを付けると_4_要素目がカンマ区切りで分かれる(self):
        spec = parse_section_arg("内部の挙動:backend 内部部品の検証:a/b.xml:src/domain/,src/service/")
        assert spec.prefixes == ("src/domain/", "src/service/")

    @pytest.mark.parametrize(
        "value",
        [
            pytest.param("外から見た振る舞い:backend", id="コロンが 2 つに満たないとき、形式エラーになる"),
            pytest.param(":backend:a/b.xml", id="カテゴリが空のとき、形式エラーになる"),
            pytest.param("外から見た振る舞い::a/b.xml", id="ラベルが空のとき、形式エラーになる"),
            pytest.param("外から見た振る舞い:backend:", id="パスが空のとき、形式エラーになる"),
            pytest.param("外から見た振る舞い:backend:a/b.xml:", id="プレフィクス指定が空文字のとき、形式エラーになる"),
        ],
    )
    def test_parse_section_arg_の形式エラー(self, value):
        with pytest.raises(argparse.ArgumentTypeError):
            parse_section_arg(value)


class TestMain:
    def test_JUnit_XML_を渡すと_Markdown_カタログが標準出力に出る(self, tmp_path, capsys):
        path = write_junit_xml(
            tmp_path,
            '<testsuite name="dummy.test.ts">' + case_xml("グループA &gt; ケースX") + "</testsuite>",
        )
        main(["--format", "markdown", "--section", f"外から見た振る舞い:backend:{path}", "--commit", "dummysha"])
        output = capsys.readouterr().out
        assert "# pokelingual テスト観点カタログ" in output
        assert "## 外から見た振る舞い" in output
        assert "### backend（全 1 ケース）" in output
        assert "- ケースX" in output
        assert "生成元 commit: `dummysha`" in output

    def test_存在しないパスを渡すとエラーで停止する(self, tmp_path):
        missing = tmp_path / "missing.xml"
        with pytest.raises(FileNotFoundError):
            main(["--format", "markdown", "--section", f"外から見た振る舞い:backend:{missing}"])
