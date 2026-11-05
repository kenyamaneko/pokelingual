import pytest

from generate_behavior_catalog import (
    BehaviorCase,
    GroupNode,
    build_catalog,
    build_group_tree,
    count_cases,
    extract_top_level_tag,
    main,
    parse_junit_file,
    render_html,
    render_markdown,
    split_test_name,
    tag_sort_key,
)


def write_junit_xml(tmp_path, body, filename="junit.xml"):
    """testsuites で包んだ JUnit XML をテスト用に書き出す。

    Args:
        tmp_path: 書き出し先ディレクトリ。
        body: testsuites 要素の中身となる XML 断片。
        filename: 書き出すファイル名。

    Returns:
        書き出したファイルのパス。
    """
    path = tmp_path / filename
    path.write_text(f'<?xml version="1.0" encoding="UTF-8"?><testsuites>{body}</testsuites>', encoding="utf-8")
    return path


def build_case_xml(name, classname="dummy.test.ts", is_skipped=False):
    """1 件の testcase 要素の XML 断片を組み立てる。

    Args:
        name: testcase の name 属性。
        classname: testcase の classname 属性。
        is_skipped: skipped 子要素を付けるかどうか。

    Returns:
        testcase 要素の XML 断片。
    """
    inner = "<skipped/>" if is_skipped else ""
    return f'<testcase classname="{classname}" name="{name}">{inner}</testcase>'


def build_case(case_name, is_skipped=False):
    """グループに属さない 1 件のケースを組み立てる。

    Args:
        case_name: ケースの名前。
        is_skipped: skip 中のケースにするかどうか。

    Returns:
        テストファイルのパスがダミーのケース。
    """
    return BehaviorCase((), case_name, is_skipped=is_skipped)


def build_group_node(cases=(), subgroups=None):
    """ケースと下位グループを直接指定してグループの木を組み立てる。

    Args:
        cases: グループ直下に置くケースの並び。
        subgroups: 名前をキーにした下位グループ。省略時は下位グループなし。

    Returns:
        組み立てたグループの木。
    """
    node = GroupNode()
    node.cases.extend(cases)
    node.subgroups.update(subgroups or {})
    return node


class Test運用__テスト観点カタログ__テスト名の区切り:
    class Testテスト名を区切ると:
        class Test単体テスト:
            class Test正常系:
                @pytest.mark.parametrize(
                    ("raw_name", "expected_case_name"),
                    [
                        pytest.param(
                            "ケースX",
                            "ケースX",
                            id="テスト名が「ケースX」(区切りなし) のとき、ケースの名前は「ケースX」になる",
                        ),
                        pytest.param(
                            "グループA > ケースX",
                            "ケースX",
                            id="テスト名が「グループA > ケースX」(Vitest の区切り「 > 」が 1 つ) のとき、ケースの名前は「ケースX」になる",
                        ),
                        pytest.param(
                            "グループA > グループB > ケースX",
                            "ケースX",
                            id="テスト名が「グループA > グループB > ケースX」(Vitest の区切りが 2 つ) のとき、ケースの名前は「ケースX」になる",
                        ),
                        pytest.param(
                            "グループA › ケースX",
                            "ケースX",
                            id="テスト名が「グループA › ケースX」(Playwright の区切り「 › 」が 1 つ) のとき、ケースの名前は「ケースX」になる",
                        ),
                    ],
                )
                def test_split_test_name_returns_case_name(self, raw_name, expected_case_name):
                    _, case_name = split_test_name(raw_name)
                    assert case_name == expected_case_name

                @pytest.mark.parametrize(
                    "raw_name",
                    [
                        pytest.param("ケースX", id="テスト名が「ケースX」(区切りなし) のとき、グループは無い"),
                        pytest.param(
                            "a->b の変換",
                            id="テスト名が「a->b の変換」(空白を伴わない「>」を含む) のとき、グループは無い",
                        ),
                    ],
                )
                def test_split_test_name_returns_no_group(self, raw_name):
                    chain, _ = split_test_name(raw_name)
                    assert chain == ()

                @pytest.mark.parametrize(
                    "raw_name",
                    [
                        pytest.param(
                            "グループA > ケースX",
                            id="テスト名が「グループA > ケースX」(Vitest の区切り「 > 」が 1 つ) のとき、グループは「グループA」になる",
                        ),
                        pytest.param(
                            "グループA › ケースX",
                            id="テスト名が「グループA › ケースX」(Playwright の区切り「 › 」が 1 つ) のとき、グループは「グループA」になる",
                        ),
                    ],
                )
                def test_split_test_name_returns_one_group(self, raw_name):
                    chain, _ = split_test_name(raw_name)
                    assert chain == ("グループA",)

                @pytest.mark.parametrize(
                    "raw_name",
                    [
                        pytest.param(
                            "グループA > グループB > ケースX",
                            id="テスト名が「グループA > グループB > ケースX」(Vitest の区切りが 2 つ) のとき、グループは外側から「グループA」「グループB」の入れ子になる",
                        ),
                    ],
                )
                def test_split_test_name_returns_nested_groups(self, raw_name):
                    chain, _ = split_test_name(raw_name)
                    assert chain == ("グループA", "グループB")

                @pytest.mark.parametrize(
                    "raw_name",
                    [
                        pytest.param(
                            "a->b の変換",
                            id="テスト名が「a->b の変換」(空白を伴わない「>」を含む) のとき、区切りとみなされず、ケースの名前は「a->b の変換」になる",
                        ),
                    ],
                )
                def test_split_test_name_keeps_unspaced_arrow_in_case_name(self, raw_name):
                    _, case_name = split_test_name(raw_name)
                    assert case_name == "a->b の変換"


class Test運用__テスト観点カタログ__トップレベルのタグ見出し:
    class Testグループ名の並びにタグ見出しを付けると:
        class Test単体テスト:
            class Test正常系:
                def test_グループが無いとき_結果は空になる(self):
                    assert extract_top_level_tag(()) == ()

                def test_トップレベルのグループ名がグループAでタグなしのとき_結果はその他_グループAの入れ子になる(self):
                    assert extract_top_level_tag(("グループA",)) == ("その他", "グループA")

                @pytest.mark.parametrize(
                    "chain",
                    [
                        pytest.param(
                            ("[本体:認証] ログイン画面",),
                            id="トップレベルのグループ名が「[本体:認証] ログイン画面」(タグの後ろに空白あり) のとき、結果は「本体」「認証」「ログイン画面」の入れ子になる",
                        ),
                        pytest.param(
                            ("[本体:認証]ログイン画面",),
                            id="トップレベルのグループ名が「[本体:認証]ログイン画面」(タグの後ろに空白なし) のとき、結果は「本体」「認証」「ログイン画面」の入れ子になる",
                        ),
                    ],
                )
                def test_extract_top_level_tag_nests_tag_and_group_name(self, chain):
                    assert extract_top_level_tag(chain) == ("本体", "認証", "ログイン画面")

                @pytest.mark.parametrize(
                    "chain",
                    [
                        pytest.param(
                            ("[本体:認証] ログイン画面", "[サブ] 入力欄"),
                            id="グループが「[本体:認証] ログイン画面」「[サブ] 入力欄」の 2 段のとき、結果は「本体」「認証」「ログイン画面」「[サブ] 入力欄」の入れ子になり、2 段目はタグとして取り出されず名前のまま残る",
                        ),
                    ],
                )
                def test_extract_top_level_tag_keeps_second_level_tag_in_name(self, chain):
                    assert extract_top_level_tag(chain) == ("本体", "認証", "ログイン画面", "[サブ] 入力欄")

            class Test異常系:
                @pytest.mark.parametrize(
                    "chain",
                    [
                        pytest.param(
                            ("[本体:認証 ログイン画面",),
                            id="トップレベルのグループ名が「[本体:認証 ログイン画面」(角括弧が閉じていない) のとき、結果は「その他」の下に「[本体:認証 ログイン画面」がそのまま入る",
                        ),
                    ],
                )
                def test_extract_top_level_tag_puts_unclosed_bracket_name_under_other(self, chain):
                    assert extract_top_level_tag(chain) == ("その他", "[本体:認証 ログイン画面")


class Test運用__テスト観点カタログ__区分の見出しの並び順:
    class Test区分の見出しを並べると:
        class Test単体テスト:
            class Test正常系:
                def test_区分がその他と本体のとき_本体_その他の順になる(self):
                    assert sorted(["その他", "本体"], key=tag_sort_key) == ["本体", "その他"]

                def test_区分が外部連携と運用と本体のとき_本体_運用_外部連携の順になる(self):
                    assert sorted(["外部連携", "運用", "本体"], key=tag_sort_key) == ["本体", "運用", "外部連携"]


class Test運用__テスト観点カタログ__JUnit_XMLの読み取り:
    class Testインフラ結合テスト:
        class Test正常系:
            def test_テスト結果が0件のとき_読み取ると_ケースの一覧は空になる(self, tmp_path):
                path = write_junit_xml(tmp_path, '<testsuite name="dummy.test.ts"></testsuite>')
                assert parse_junit_file(path) == []

            def test_テスト結果がskipされたケースXのとき_読み取ると_そのケースはskip中になる(self, tmp_path):
                path = write_junit_xml(
                    tmp_path,
                    '<testsuite name="dummy.test.ts">' + build_case_xml("ケースX", is_skipped=True) + "</testsuite>",
                )
                assert parse_junit_file(path) == [
                    BehaviorCase((), "ケースX", is_skipped=True)
                ]

        class Test異常系:
            def test_テスト結果にテスト名が無いとき_読み取ると_testcase_に_name_属性がありませんというテスト名が無いことを示すエラーになる(
                self, tmp_path
            ):
                path = write_junit_xml(tmp_path, '<testsuite name="dummy.test.ts"><testcase/></testsuite>')
                with pytest.raises(ValueError, match="testcase に name 属性がありません"):
                    parse_junit_file(path)

            def test_テスト結果にテスト名が無くエラーになったあと_テスト名のあるファイルに直して読み取ると_ケースXが読み取られる(
                self, tmp_path
            ):
                path = write_junit_xml(tmp_path, '<testsuite name="dummy.test.ts"><testcase/></testsuite>')
                with pytest.raises(ValueError, match="testcase に name 属性がありません"):
                    parse_junit_file(path)

                write_junit_xml(
                    tmp_path,
                    '<testsuite name="dummy.test.ts">' + build_case_xml("ケースX") + "</testsuite>",
                )

                assert parse_junit_file(path) == [
                    BehaviorCase((), "ケースX", is_skipped=False)
                ]


    class Testテスト結果がグループAのケース1とケース2の2件のとき:
        class Test読み取ると:
            class Testインフラ結合テスト:
                class Test正常系:
                    @pytest.fixture
                    def cases(self, tmp_path):
                        path = write_junit_xml(
                            tmp_path,
                            '<testsuite name="dummy.test.ts">'
                            + build_case_xml("グループA &gt; ケース1")
                            + build_case_xml("グループA &gt; ケース2")
                            + "</testsuite>",
                        )
                        return parse_junit_file(path)

                    def test_ケースの名前は記録された順にケース1とケース2になる(self, cases):
                        assert [case.case_name for case in cases] == ["ケース1", "ケース2"]

                    def test_どちらのケースもグループはグループAになる(self, cases):
                        assert [case.group_chain for case in cases] == [("グループA",), ("グループA",)]

                    def test_どちらのケースもskip中にならない(self, cases):
                        assert [case.is_skipped for case in cases] == [False, False]


class Test運用__テスト観点カタログ__ケースのグループ階層:
    class Testケースをグループ階層にまとめると:
        class Test単体テスト:
            class Test正常系:
                def test_グループAに属するケース1とケース2があるとき_グループAの下にケース1とケース2がこの順に並ぶ(
                    self,
                ):
                    tree = build_group_tree(
                        [
                            BehaviorCase(("グループA",), "ケース1", is_skipped=False),
                            BehaviorCase(("グループA",), "ケース2", is_skipped=False),
                        ]
                    )
                    assert list(tree.subgroups) == ["グループA"]
                    assert [case.case_name for case in tree.subgroups["グループA"].cases] == ["ケース1", "ケース2"]

                def test_グループに属さないケースXが1件のとき_そのケースだけがセクション直下に置かれ_グループは無い(
                    self,
                ):
                    tree = build_group_tree([build_case("ケースX")])
                    assert [case.case_name for case in tree.cases] == ["ケースX"]
                    assert tree.subgroups == {}

                def test_ケースXのグループがグループAとグループBの2段の入れ子のとき_グループAの下のグループBの下にケースが置かれる(
                    self,
                ):
                    tree = build_group_tree(
                        [
                            BehaviorCase(
                                ("グループA", "グループB"), "ケースX", is_skipped=False
                            )
                        ]
                    )
                    inner = tree.subgroups["グループA"].subgroups["グループB"]
                    assert [case.case_name for case in inner.cases] == ["ケースX"]


class Test運用__テスト観点カタログ__ケース数の集計:
    class Testケース数を数えると:
        class Test単体テスト:
            class Test正常系:
                def test_ケースが0件のとき_ケース数は0になる(self):
                    assert count_cases(GroupNode()) == 0

                def test_ケースがセクション直下に1件あるとき_ケース数は1になる(self):
                    tree = build_group_node(cases=[build_case("ケースX")])
                    assert count_cases(tree) == 1

                def test_ケースがセクション直下と_1段目のグループAと_2段目のグループBに1件ずつあるとき_ケース数は3になる(
                    self,
                ):
                    tree = build_group_node(
                        cases=[build_case("ケース1")],
                        subgroups={
                            "グループA": build_group_node(
                                cases=[build_case("ケース2")],
                                subgroups={"グループB": build_group_node(cases=[build_case("ケース3")])},
                            )
                        },
                    )
                    assert count_cases(tree) == 3


def write_catalog_junit(tmp_path, names, filename="junit.xml"):
    """ケース名を並べた JUnit XML を書き出す。

    Args:
        tmp_path: 書き出し先ディレクトリ。
        names: testcase の name 属性の並び。
        filename: 書き出すファイル名。

    Returns:
        書き出したファイルのパス。
    """
    return write_junit_xml(
        tmp_path,
        '<testsuite name="dummy">' + "".join(build_case_xml(name) for name in names) + "</testsuite>",
        filename=filename,
    )


class Test運用__テスト観点カタログ__カタログの組み立て:
    class Test複数のJUnit_XMLに本体の認証と運用の設定読み込みのケースが分かれてあるとき:
        class Testカタログにまとめると:
            class Testインフラ結合テスト:
                class Test正常系:
                    @pytest.fixture
                    def root(self, tmp_path):
                        backend = write_catalog_junit(tmp_path, ["[本体:認証]ログイン &gt; ケース1"], "backend.xml")
                        frontend = write_catalog_junit(tmp_path, ["[運用:設定]読み込み &gt; ケース2"], "frontend.xml")
                        return build_catalog([backend, frontend])

                    def test_JUnit_XMLの数によらず_区分は本体と運用の2つになる(self, root):
                        assert set(root.subgroups) == {"本体", "運用"}

                    def test_本体の下に大機能認証_その下に小機能ログイン_その下にケース1が入る(self, root):
                        node = root.subgroups["本体"].subgroups["認証"].subgroups["ログイン"]
                        assert [case.case_name for case in node.cases] == ["ケース1"]

                    def test_運用の下に大機能設定_その下に小機能読み込み_その下にケース2が入る(self, root):
                        node = root.subgroups["運用"].subgroups["設定"].subgroups["読み込み"]
                        assert [case.case_name for case in node.cases] == ["ケース2"]

    class Testタグの無い小機能がある_JUnit_XMLのとき:
        class Testカタログにまとめると:
            class Testインフラ結合テスト:
                class Test正常系:
                    def test_タグの無い小機能は_区分その他の下に入る(self, tmp_path):
                        path = write_catalog_junit(tmp_path, ["ヘッダー &gt; ケース3"])
                        root = build_catalog([path])
                        assert list(root.subgroups) == ["その他"]
                        assert list(root.subgroups["その他"].subgroups) == ["ヘッダー"]


def build_catalog_node():
    """区分本体の大機能認証に小機能ログインのケース1がある木を作る。

    Returns:
        ルートのグループ木。
    """
    return build_group_node(
        subgroups={
            "本体": build_group_node(
                subgroups={
                    "認証": build_group_node(
                        subgroups={"ログイン": build_group_node(cases=[build_case("ケース1"), build_case("ケース2")])}
                    )
                }
            )
        }
    )


class Test運用__テスト観点カタログ__Markdown形式の出力:
    class TestMarkdown形式で出力すると:
        class Test単体テスト:
            class Test正常系:
                def test_ケースが無いとき_本カタログは自動テストのテスト名から生成したで始まる注意書きの行が_引用として入る(
                    self,
                ):
                    output = render_markdown(build_group_node(), commit=None)
                    disclaimer_line = next(
                        line for line in output.splitlines() if "本カタログは自動テストのテスト名から生成した" in line
                    )
                    assert disclaimer_line.startswith("> ")

                def test_区分本体にケース1とケース2があるとき_区分の見出しは本体全_2_ケースになる(self):
                    output = render_markdown(build_catalog_node(), commit=None)
                    assert "## 本体（全 2 ケース）" in output

                def test_区分の下の大機能と小機能は_入れ子の太字の項目として入る(self):
                    output = render_markdown(build_catalog_node(), commit=None)
                    assert "- **認証**\n  - **ログイン**\n    - ケース1\n" in output

                def test_区分がその他_運用_外部連携_本体のとき_見出しは本体_運用_外部連携_その他の順に並ぶ(self):
                    root = build_group_node(
                        subgroups={
                            name: build_group_node(cases=[build_case("ケースX")])
                            for name in ["その他", "外部連携", "運用", "本体"]
                        }
                    )
                    output = render_markdown(root, commit=None)
                    positions = [output.index(f"## {name}（全") for name in ["本体", "運用", "外部連携", "その他"]]
                    assert positions == sorted(positions)

                def test_大機能がグループBのケース1_続けてグループAのケース2の順に入力したとき_グループA_グループBの順に並ぶ(
                    self,
                ):
                    root = build_group_node(
                        subgroups={
                            "本体": build_group_node(
                                subgroups={
                                    "グループB": build_group_node(cases=[build_case("ケース1")]),
                                    "グループA": build_group_node(cases=[build_case("ケース2")]),
                                }
                            )
                        }
                    )
                    output = render_markdown(root, commit=None)
                    assert output.index("**グループA**") < output.index("**グループB**")

                def test_skipされたケースXのとき_ケースXの項目にskip_中のため未検証の注記が入る(self):
                    root = build_group_node(cases=[build_case("ケースX", is_skipped=True)])
                    output = render_markdown(root, commit=None)
                    assert "- ケースX（skip 中のため未検証）" in output

                @pytest.mark.parametrize(
                    "case_name",
                    [
                        pytest.param(
                            "<App /> を表示する",
                            id="ケースの名前が「<App /> を表示する」のとき、出力には「&lt;App /&gt; を表示する」が入る",
                        ),
                    ],
                )
                def test_render_markdown_escapes_angle_brackets_in_case_name(self, case_name):
                    output = render_markdown(build_group_node(cases=[build_case(case_name)]), commit=None)
                    assert "&lt;App /&gt; を表示する" in output

                def test_生成元_commitにdummyshaを指定したとき_生成元_commit_dummyshaの行が入る(self):
                    output = render_markdown(build_group_node(), commit="dummysha")
                    assert "生成元 commit: `dummysha`" in output

                def test_生成元_commitを指定しないとき_出力に生成元_commitは入らない(self):
                    output = render_markdown(build_group_node(), commit=None)
                    assert "生成元 commit" not in output


class Test運用__テスト観点カタログ__HTML形式の出力:
    class TestHTML形式で出力すると:
        class Test単体テスト:
            class Test正常系:
                def test_ページの言語は日本語になる(self):
                    assert '<html lang="ja">' in render_html(build_group_node(), commit=None)

                def test_本カタログは自動テストのテスト名から生成したで始まる注意書きが入る(self):
                    output = render_html(build_group_node(), commit=None)
                    assert "本カタログは自動テストのテスト名から生成した" in output

                def test_生成元_commitにdummyshaを指定したとき_dummyshaがコード表示で入る(self):
                    output = render_html(build_group_node(), commit="dummysha")
                    assert "<code>dummysha</code>" in output

                def test_区分本体にケース1とケース2があるとき_区分の見出しは本体全_2_ケースになる(self):
                    output = render_html(build_catalog_node(), commit=None)
                    assert "<h2>本体（全 2 ケース）</h2>" in output

                def test_小機能ログインにケース1とケース2があるとき_小機能が折りたたみ表示の見出しになり_ケースが箇条書きの項目として入る(
                    self,
                ):
                    output = render_html(build_catalog_node(), commit=None)
                    assert "<details><summary>ログイン（全 2 ケース）</summary>" in output
                    assert "<li>ケース1</li>" in output
                    assert "<li>ケース2</li>" in output

                def test_大機能認証の折りたたみ表示の中に_小機能ログインの折りたたみ表示が入る(self):
                    output = render_html(build_catalog_node(), commit=None)
                    outer_start = output.index("<details><summary>認証")
                    inner_start = output.index("<details><summary>ログイン")
                    inner_end = output.index("</details>", inner_start)
                    outer_end = output.index("</details>", inner_end + 1)
                    assert outer_start < inner_start < inner_end < outer_end

                def test_区分がその他_運用_外部連携_本体のとき_見出しは本体_運用_外部連携_その他の順に並ぶ(self):
                    root = build_group_node(
                        subgroups={
                            name: build_group_node(cases=[build_case("ケースX")])
                            for name in ["その他", "外部連携", "運用", "本体"]
                        }
                    )
                    output = render_html(root, commit=None)
                    positions = [output.index(f"<h2>{name}（全") for name in ["本体", "運用", "外部連携", "その他"]]
                    assert positions == sorted(positions)

                def test_skipされたケースXのとき_ケースXがskip_中のため未検証の注記付きで区別表示の項目として入る(self):
                    root = build_group_node(cases=[build_case("ケースX", is_skipped=True)])
                    output = render_html(root, commit=None)
                    assert '<li class="skipped">ケースX（skip 中のため未検証）</li>' in output

                @pytest.mark.parametrize(
                    "case_name",
                    [
                        pytest.param(
                            "<App /> を表示する",
                            id="ケースの名前が「<App /> を表示する」のとき、出力には「&lt;App /&gt; を表示する」が入る",
                        ),
                    ],
                )
                def test_render_html_escapes_angle_brackets_in_case_name(self, case_name):
                    output = render_html(build_group_node(cases=[build_case(case_name)]), commit=None)
                    assert "&lt;App /&gt; を表示する" in output


class Test運用__テスト観点カタログ__生成コマンド:
    class TestMarkdown形式と生成元_commitを指定し_2つのJUnit_XMLに本体の認証と運用の設定読み込みのケースがあるとき:
        class Testコマンドを実行すると:
            class Testインフラ結合テスト:
                class Test正常系:
                    @pytest.fixture
                    def output(self, tmp_path, capsys):
                        backend = write_catalog_junit(tmp_path, ["[本体:認証]ログイン &gt; ケース1"], "backend.xml")
                        frontend = write_catalog_junit(tmp_path, ["[運用:設定]読み込み &gt; ケース2"], "frontend.xml")
                        main(
                            ["--format", "markdown", "--junit", str(backend), "--junit", str(frontend), "--commit", "dummysha"]
                        )
                        return capsys.readouterr().out

                    def test_標準出力にページの題名_pokelingual_テスト観点カタログが入る(self, output):
                        assert "# pokelingual テスト観点カタログ" in output

                    def test_標準出力に_区分の見出しが本体_運用の順で入る(self, output):
                        assert output.index("## 本体（全 1 ケース）") < output.index("## 運用（全 1 ケース）")

                    def test_標準出力に_両方のJUnit_XMLのケースが箇条書きの項目として入る(self, output):
                        assert "- ケース1" in output
                        assert "- ケース2" in output

                    def test_標準出力に_指定した生成元_commitが生成元_commit_dummyshaとして入る(self, output):
                        assert "生成元 commit: `dummysha`" in output

    class Testコマンドを実行すると:
        class Testインフラ結合テスト:
            class Test異常系:
                @pytest.mark.parametrize(
                    "missing_filename",
                    [
                        pytest.param(
                            "missing.xml",
                            id="JUnit XML のパスが存在しない (「missing.xml」) とき、そのパス「missing.xml」を含む、ファイルが見つからないエラーで停止する",
                        ),
                    ],
                )
                def test_main_stops_with_file_not_found_error_for_missing_junit_xml(self, tmp_path, missing_filename):
                    missing = tmp_path / missing_filename
                    with pytest.raises(FileNotFoundError, match=missing_filename):
                        main(["--format", "markdown", "--junit", str(missing)])

            def test_JUnit_XMLのパスが存在せずファイルが見つからないエラーで停止したあと_そのパスにJUnit_XMLを置いて再実行すると_標準出力にケースXの箇条書きの項目が入る(
                self, tmp_path, capsys
            ):
                path = tmp_path / "junit.xml"
                arguments = ["--format", "markdown", "--junit", str(path)]
                with pytest.raises(FileNotFoundError):
                    main(arguments)

                write_catalog_junit(tmp_path, ["[本体:認証]ログイン &gt; ケースX"])
                main(arguments)

                assert "- ケースX" in capsys.readouterr().out


class Test運用__テスト観点カタログ__タグの項目の区切り:
    class Testグループ名の並びにタグ見出しを付けると:
        class Test単体テスト:
            class Test正常系:
                @pytest.mark.parametrize(
                    "chain",
                    [
                        pytest.param(
                            ("[本体:クエスト] 出題",),
                            id="トップレベルのグループ名が「[本体:クエスト] 出題」(区分と大機能の 2 項目) のとき、結果は「本体」「クエスト」「出題」の入れ子になる",
                        ),
                    ],
                )
                def test_extract_top_level_tag_nests_category_and_feature_tag_items(self, chain):
                    assert extract_top_level_tag(chain) == ("本体", "クエスト", "出題")

                @pytest.mark.parametrize(
                    "chain",
                    [
                        pytest.param(
                            ("[本体:決済:クレジットカード決済]決済の実行", "単体テスト", "正常系"),
                            id="グループが「[本体:決済:クレジットカード決済]決済の実行」「単体テスト」「正常系」(区分・大機能・中機能の 3 項目で、その下に種別と正常異常) のとき、結果は「本体」「決済」「クレジットカード決済」「決済の実行」「単体テスト」「正常系」の入れ子になる",
                        ),
                    ],
                )
                def test_extract_top_level_tag_nests_three_tag_items_and_lower_groups(self, chain):
                    assert extract_top_level_tag(chain) == (
                        "本体",
                        "決済",
                        "クレジットカード決済",
                        "決済の実行",
                        "単体テスト",
                        "正常系",
                    )

            class Test異常系:
                @pytest.mark.parametrize(
                    "chain",
                    [
                        pytest.param(
                            ("[本体::出題] 出題",),
                            id="トップレベルのグループ名が「[本体::出題] 出題」(大機能の項目が空) のとき、「タグの項目が空です」というタグの項目が空であることを示すエラーになる",
                        ),
                    ],
                )
                def test_extract_top_level_tag_rejects_empty_tag_item(self, chain):
                    with pytest.raises(ValueError, match="タグの項目が空です"):
                        extract_top_level_tag(chain)

                @pytest.mark.parametrize(
                    "chain",
                    [
                        pytest.param(
                            ("[本体:クエスト:出題:採点] 出題",),
                            id="トップレベルのグループ名が「[本体:クエスト:出題:採点] 出題」(項目が 4 つ) のとき、「項目は 2 つから 3 つまでです」という項目数の範囲を示すエラーになる",
                        ),
                    ],
                )
                def test_extract_top_level_tag_rejects_more_than_three_tag_items(self, chain):
                    with pytest.raises(ValueError, match="項目は 2 つから 3 つまでです"):
                        extract_top_level_tag(chain)

                @pytest.mark.parametrize(
                    "chain",
                    [
                        pytest.param(
                            ("[本体] 出題",),
                            id="トップレベルのグループ名が「[本体] 出題」(項目が 1 つ) のとき、「項目は 2 つから 3 つまでです」という項目数の範囲を示すエラーになる",
                        ),
                    ],
                )
                def test_extract_top_level_tag_rejects_fewer_than_two_tag_items(self, chain):
                    with pytest.raises(ValueError, match="項目は 2 つから 3 つまでです"):
                        extract_top_level_tag(chain)

                @pytest.mark.parametrize(
                    "chain",
                    [
                        pytest.param(
                            ("[クエスト:出題] 出題",),
                            id="トップレベルのグループ名が「[クエスト:出題] 出題」(最初の項目が区分でない) のとき、区分の候補「本体」「運用」「外部連携」を示すエラーになる",
                        ),
                    ],
                )
                def test_extract_top_level_tag_rejects_first_item_that_is_not_category(self, chain):
                    with pytest.raises(ValueError, match="本体・運用・外部連携 のいずれかにしてください"):
                        extract_top_level_tag(chain)
