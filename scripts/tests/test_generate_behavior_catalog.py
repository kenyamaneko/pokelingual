import argparse

import pytest

from generate_behavior_catalog import (
    BehaviorCase,
    GroupNode,
    SectionSpec,
    build_group_tree,
    count_cases,
    extract_top_level_tag,
    has_top_level_tag,
    main,
    parse_junit_file,
    parse_section_arg,
    render_html,
    render_markdown,
    route_cases_to_specs,
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
    return BehaviorCase((), case_name, is_skipped=is_skipped, source_file="dummy.test.ts")


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


class Test運用__テスト観点カタログ__トップレベルのタグ有無の判定:
    class Testタグの有無を判定すると:
        class Test単体テスト:
            class Test正常系:
                @pytest.mark.parametrize(
                    "chain",
                    [
                        pytest.param((), id="グループが無いとき、タグ無しになる"),
                        pytest.param(("グループA",), id="トップレベルのグループ名が「グループA」のとき、タグ無しになる"),
                    ],
                )
                def test_has_top_level_tag_returns_false(self, chain):
                    assert has_top_level_tag(chain) is False

                @pytest.mark.parametrize(
                    "chain",
                    [
                        pytest.param(
                            ("[本体:認証] ログイン画面",),
                            id="トップレベルのグループ名が「[本体:認証] ログイン画面」のとき、タグ有りになる",
                        ),
                    ],
                )
                def test_has_top_level_tag_returns_true(self, chain):
                    assert has_top_level_tag(chain) is True


class Test運用__テスト観点カタログ__タグ見出しの並び順:
    class Testタグ見出しを並べると:
        class Test単体テスト:
            class Test正常系:
                def test_タグ名がその他と本体のとき_本体_その他の順になる(self):
                    assert sorted(["その他", "本体"], key=tag_sort_key) == ["本体", "その他"]

                def test_タグ名が運用と本体のとき_本体_運用の順になる(self):
                    assert sorted(["運用", "本体"], key=tag_sort_key) == ["本体", "運用"]


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
                    BehaviorCase((), "ケースX", is_skipped=True, source_file="dummy.test.ts")
                ]

        class Test異常系:
            def test_テスト結果にテスト名が無いとき_読み取ると_testcase_に_name_属性がありませんというテスト名が無いことを示すエラーになる(
                self, tmp_path
            ):
                path = write_junit_xml(tmp_path, '<testsuite name="dummy.test.ts"><testcase/></testsuite>')
                with pytest.raises(ValueError, match="testcase に name 属性がありません"):
                    parse_junit_file(path)

            def test_テスト結果にテストファイルのパスが無いとき_読み取ると_testcase_に_classname_属性がありませんというテストファイルのパスが無いことを示すエラーになる(
                self, tmp_path
            ):
                path = write_junit_xml(
                    tmp_path, '<testsuite name="dummy.test.ts"><testcase name="ケースX"/></testsuite>'
                )
                with pytest.raises(ValueError, match="testcase に classname 属性がありません"):
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
                    BehaviorCase((), "ケースX", is_skipped=False, source_file="dummy.test.ts")
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

    class Test読み取ると:
        class Testインフラ結合テスト:
            class Test正常系:
                @pytest.mark.parametrize(
                    "source_file",
                    [
                        pytest.param(
                            "src/router/router.test.ts",
                            id="テスト結果のテストファイルのパスが「src/router/router.test.ts」のとき、ケースのテストファイルのパスは「src/router/router.test.ts」になる",
                        ),
                    ],
                )
                def test_parse_junit_file_returns_source_file_of_case(self, tmp_path, source_file):
                    path = write_junit_xml(
                        tmp_path,
                        '<testsuite name="dummy.test.ts">'
                        + build_case_xml("ケースX", classname=source_file)
                        + "</testsuite>",
                    )
                    assert parse_junit_file(path)[0].source_file == source_file


class Test運用__テスト観点カタログ__ケースのグループ階層:
    class Testケースをグループ階層にまとめると:
        class Test単体テスト:
            class Test正常系:
                def test_グループAに属するケース1とケース2があるとき_グループAの下にケース1とケース2がこの順に並ぶ(
                    self,
                ):
                    tree = build_group_tree(
                        [
                            BehaviorCase(("グループA",), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
                            BehaviorCase(("グループA",), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
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
                                ("グループA", "グループB"), "ケースX", is_skipped=False, source_file="dummy.test.ts"
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


class Test運用__テスト観点カタログ__セクションへの振り分け:
    class Testケースをセクションに振り分けると:
        class Test単体テスト:
            class Test正常系:
                @pytest.mark.parametrize(
                    "source_file",
                    [
                        pytest.param(
                            "src/App.test.tsx",
                            id="プレフィクスの指定が無いセクションが 1 件で、ケースのテストファイルのパスが「src/App.test.tsx」のとき、そのケースがそのセクションに振り分けられる",
                        ),
                    ],
                )
                def test_route_cases_to_specs_routes_case_to_spec_without_prefix(self, source_file):
                    spec = SectionSpec("外から見た振る舞い", "frontend", "junit.xml", prefixes=None)
                    cases = [BehaviorCase((), "ケースX", is_skipped=False, source_file=source_file)]
                    assert route_cases_to_specs([spec], cases) == {spec: cases}

            class Test異常系:
                @pytest.mark.parametrize(
                    "source_file",
                    [
                        pytest.param(
                            "src/config/config.test.ts",
                            id="セクションのプレフィクスが「src/router/」だけで、ケースのテストファイルのパスが「src/config/config.test.ts」のとき、「どのセクションにも振り分けられない」という振り分け先が無いことを示すエラーになる",
                        ),
                    ],
                )
                def test_route_cases_to_specs_rejects_case_matching_no_prefix(self, source_file):
                    router_spec = SectionSpec(
                        "外から見た振る舞い", "backend API の振る舞い", "junit.xml", prefixes=("src/router/",)
                    )
                    unrouted_case = BehaviorCase((), "設定の検証", is_skipped=False, source_file=source_file)

                    with pytest.raises(ValueError, match="どのセクションにも振り分けられない"):
                        route_cases_to_specs([router_spec], [unrouted_case])

                @pytest.mark.parametrize(
                    "source_file",
                    [
                        pytest.param(
                            "src/domain/exclusion.test.ts",
                            id="プレフィクス「src/」のセクションとプレフィクス「src/domain/」のセクションがあり、ケースのテストファイルのパスが「src/domain/exclusion.test.ts」のとき、「複数のセクションに振り分けられる」という振り分け先が複数あることを示すエラーになる",
                        ),
                    ],
                )
                def test_route_cases_to_specs_rejects_case_matching_multiple_prefixes(self, source_file):
                    outer_spec = SectionSpec("外から見た振る舞い", "セクションA", "junit.xml", prefixes=("src/",))
                    inner_spec = SectionSpec("内部の挙動", "セクションB", "junit.xml", prefixes=("src/domain/",))
                    ambiguous_case = BehaviorCase((), "除外の判定", is_skipped=False, source_file=source_file)

                    with pytest.raises(ValueError, match="複数のセクションに振り分けられる"):
                        route_cases_to_specs([outer_spec, inner_spec], [ambiguous_case])


    class Testプレフィクスsrc配下のrouterのセクションとプレフィクスsrc配下のdomainのセクションがあるとき:
        class Testケースをセクションに振り分けると:
            class Test単体テスト:
                class Test正常系:
                    @pytest.fixture
                    def router_spec(self):
                        return SectionSpec(
                            "外から見た振る舞い", "backend API の振る舞い", "junit.xml", prefixes=("src/router/",)
                        )

                    @pytest.fixture
                    def domain_spec(self):
                        return SectionSpec("内部の挙動", "backend 内部部品の検証", "junit.xml", prefixes=("src/domain/",))

                    @pytest.mark.parametrize(
                        "source_file",
                        [
                            pytest.param(
                                "src/router/router.test.ts",
                                id="ケースのテストファイルのパスが「src/router/router.test.ts」のとき、そのケースはプレフィクス「src/router/」のセクションに振り分けられる",
                            ),
                        ],
                    )
                    def test_route_cases_to_specs_routes_case_to_spec_with_matching_prefix_router(
                        self, router_spec, domain_spec, source_file
                    ):
                        case = BehaviorCase((), "ルーティングの検証", is_skipped=False, source_file=source_file)
                        assert route_cases_to_specs([router_spec, domain_spec], [case])[router_spec] == [case]

                    @pytest.mark.parametrize(
                        "source_file",
                        [
                            pytest.param(
                                "src/domain/exclusion.test.ts",
                                id="ケースのテストファイルのパスが「src/domain/exclusion.test.ts」のとき、そのケースはプレフィクス「src/domain/」のセクションに振り分けられる",
                            ),
                        ],
                    )
                    def test_route_cases_to_specs_routes_case_to_spec_with_matching_prefix_domain(
                        self, router_spec, domain_spec, source_file
                    ):
                        case = BehaviorCase((), "除外の判定", is_skipped=False, source_file=source_file)
                        assert route_cases_to_specs([router_spec, domain_spec], [case])[domain_spec] == [case]


class Test運用__テスト観点カタログ__セクションの構成:
    class Test同じJUnit_XMLにあるケースAとケースBのテストファイルのパスがそれぞれプレフィクスsrc配下のrouterとsrc配下のdomainで始まり_2つのセクションにそのプレフィクスを指定したとき:
        class TestMarkdown形式で生成すると:
            class Testインフラ結合テスト:
                class Test正常系:
                    @pytest.fixture
                    def output(self, tmp_path, capsys):
                        path = write_junit_xml(
                            tmp_path,
                            '<testsuite name="dummy">'
                            + build_case_xml("ケースA", classname="src/router/router.test.ts")
                            + build_case_xml("ケースB", classname="src/domain/exclusion.test.ts")
                            + "</testsuite>",
                        )
                        main(
                            [
                                "--format",
                                "markdown",
                                "--section",
                                f"外から見た振る舞い:backend API の振る舞い:{path}:src/router/",
                                "--section",
                                f"内部の挙動:backend 内部部品の検証:{path}:src/domain/",
                            ]
                        )
                        return capsys.readouterr().out

                    def test_出力に_カテゴリ外から見た振る舞いのセクションbackend_API_の振る舞い_カテゴリ内部の挙動のセクションbackend_内部部品の検証の順で見出しが入る(
                        self, output
                    ):
                        assert (
                            "## 外から見た振る舞い\n\n"
                            "### backend API の振る舞い（全 1 ケース）\n\n"
                            "- ケースA\n\n"
                            "## 内部の挙動\n\n"
                            "### backend 内部部品の検証（全 1 ケース）\n"
                        ) in output

                    def test_backend_API_の振る舞いの下にはケースAだけが載る(self, output):
                        assert "### backend API の振る舞い（全 1 ケース）\n\n- ケースA\n\n## 内部の挙動\n" in output

                    def test_backend_内部部品の検証の下にはケースBだけが載る(self, output):
                        assert "### backend 内部部品の検証（全 1 ケース）\n\n- ケースB\n" in output

    class TestMarkdown形式で生成すると:
        class Testインフラ結合テスト:
            class Test正常系:
                def test_外から見た振る舞いのbackend_内部の挙動のbackend_内部部品の検証_外から見た振る舞いのfrontendの順に指定したとき_出力の見出しは_外から見た振る舞いの下にbackendとfrontend_続けて内部の挙動の下にbackend_内部部品の検証の順になる(
                    self, tmp_path, capsys
                ):
                    backend_path = write_junit_xml(
                        tmp_path,
                        '<testsuite name="dummy">' + build_case_xml("ケースX") + "</testsuite>",
                        filename="backend.xml",
                    )
                    internal_path = write_junit_xml(
                        tmp_path,
                        '<testsuite name="dummy">' + build_case_xml("ケースX") + "</testsuite>",
                        filename="internal.xml",
                    )
                    frontend_path = write_junit_xml(
                        tmp_path,
                        '<testsuite name="dummy">' + build_case_xml("ケースX") + "</testsuite>",
                        filename="frontend.xml",
                    )

                    main(
                        [
                            "--format",
                            "markdown",
                            "--section",
                            f"外から見た振る舞い:backend:{backend_path}",
                            "--section",
                            f"内部の挙動:backend 内部部品の検証:{internal_path}",
                            "--section",
                            f"外から見た振る舞い:frontend:{frontend_path}",
                        ]
                    )

                    assert (
                        "## 外から見た振る舞い\n\n"
                        "### backend（全 1 ケース）\n\n"
                        "- ケースX\n\n"
                        "### frontend（全 1 ケース）\n\n"
                        "- ケースX\n\n"
                        "## 内部の挙動\n\n"
                        "### backend 内部部品の検証（全 1 ケース）\n"
                    ) in capsys.readouterr().out

                def test_タグのあるグループが1つも無く_トップレベルのグループがAPI_認証とレート制限のとき_出力の見出しはAPI_認証とレート制限の2つになる(
                    self, tmp_path, capsys
                ):
                    path = write_junit_xml(
                        tmp_path,
                        '<testsuite name="dummy">'
                        + build_case_xml("API 認証 &gt; ケース1", classname="src/middleware/auth.test.ts")
                        + build_case_xml("レート制限 &gt; ケース2", classname="src/middleware/rate-limit.test.ts")
                        + "</testsuite>",
                    )

                    main(["--format", "markdown", "--section", f"外から見た振る舞い:backend:{path}"])

                    assert (
                        "#### API 認証\n\n- ケース1\n\n#### レート制限\n\n- ケース2\n"
                    ) in capsys.readouterr().out

    class Testタグ本体__認証が付いたグループのログイン画面がsrc配下のpages配下のLoginPage_test_tsxに_新規登録画面がsrc配下のpages配下のSignupPage_test_tsxにあり_タグの無いグループのヘッダーがsrc配下のcomponents配下のHeader_test_tsxにあるとき:
        class TestMarkdown形式で生成すると:
            class Testインフラ結合テスト:
                class Test正常系:
                    @pytest.fixture
                    def output(self, tmp_path, capsys):
                        path = write_junit_xml(
                            tmp_path,
                            '<testsuite name="dummy">'
                            + build_case_xml(
                                "[本体:認証] ログイン画面 &gt; ケース1",
                                classname="src/pages/LoginPage.test.tsx",
                            )
                            + build_case_xml(
                                "[本体:認証] 新規登録画面 &gt; ケース2",
                                classname="src/pages/SignupPage.test.tsx",
                            )
                            + build_case_xml("ヘッダー &gt; ケース3", classname="src/components/Header.test.tsx")
                            + "</testsuite>",
                        )
                        main(["--format", "markdown", "--section", f"外から見た振る舞い:frontend:{path}"])
                        return capsys.readouterr().out

                    def test_出力に_見出し本体と見出しその他が入る(self, output):
                        assert "#### 本体\n" in output
                        assert "#### その他\n" in output

                    def test_本体の下に大機能認証が入る(self, output):
                        assert "#### 本体\n\n- **認証**\n" in output

                    def test_認証の下にログイン画面と新規登録画面の2つのグループが入る(self, output):
                        section = output.split("#### その他")[0].split("#### 本体")[1]
                        assert "  - **ログイン画面**\n" in section
                        assert "  - **新規登録画面**\n" in section

                    def test_タグの無いグループ_ヘッダーが_見出しその他の下にまとまる(self, output):
                        assert "#### その他\n\n- **ヘッダー**\n" in output


class Test運用__テスト観点カタログ__Markdown形式の出力:
    class TestMarkdown形式で出力すると:
        class Test単体テスト:
            class Test正常系:
                def test_セクションが無いとき_本カタログは自動テストのテスト名から生成したで始まる注意書きの行が_引用として入る(
                    self,
                ):
                    output = render_markdown([], commit=None)
                    disclaimer_line = next(
                        line for line in output.splitlines() if "本カタログは自動テストのテスト名から生成した" in line
                    )
                    assert disclaimer_line.startswith("> ")

                def test_カテゴリ外から見た振る舞いのセクションbackendにグループAのケース1とケース2があるとき_セクション見出しはbackend全_2_ケースになる(
                    self,
                ):
                    tree = build_group_node(
                        subgroups={"グループA": build_group_node(cases=[build_case("ケース1"), build_case("ケース2")])}
                    )
                    output = render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)
                    assert "### backend（全 2 ケース）" in output

                def test_同じカテゴリ外から見た振る舞いのセクションbackendとfrontendが連続するとき_見出し外から見た振る舞いは1回だけ入る(
                    self,
                ):
                    tree = build_group_node(cases=[build_case("ケースX")])
                    output = render_markdown(
                        [
                            ("外から見た振る舞い", "backend", tree),
                            ("外から見た振る舞い", "frontend", tree),
                        ],
                        commit=None,
                    )
                    assert output.count("## 外から見た振る舞い") == 1

                def test_カテゴリ外から見た振る舞いのセクションの次にカテゴリ内部の挙動のセクションが続くとき_見出し外から見た振る舞いと見出し内部の挙動がこの順に入る(
                    self,
                ):
                    tree = build_group_node(cases=[build_case("ケースX")])
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

                def test_トップレベルのグループ_グループBのケース1_続けてグループAのケース2の順に入力したとき_見出しはグループA_グループBの順に並ぶ(
                    self,
                ):
                    tree = build_group_node(
                        subgroups={
                            "グループB": build_group_node(cases=[build_case("ケース1")]),
                            "グループA": build_group_node(cases=[build_case("ケース2")]),
                        }
                    )
                    output = render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)
                    assert output.index("#### グループA") < output.index("#### グループB")

                def test_トップレベルのグループが本体_その下にログイン画面_とその他_その下にヘッダー_のとき_見出しは本体_その他の順に並ぶ(
                    self,
                ):
                    tree = build_group_node(
                        subgroups={
                            "本体": build_group_node(
                                subgroups={"ログイン画面": build_group_node(cases=[build_case("ケース1")])}
                            ),
                            "その他": build_group_node(
                                subgroups={"ヘッダー": build_group_node(cases=[build_case("ケース2")])}
                            ),
                        }
                    )
                    output = render_markdown([("外から見た振る舞い", "frontend", tree)], commit=None)
                    assert output.index("#### 本体") < output.index("#### その他")

                def test_skipされたケースXのとき_ケースXの項目にskip_中のため未検証の注記が入る(self):
                    tree = build_group_node(cases=[build_case("ケースX", is_skipped=True)])
                    output = render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)
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
                    tree = build_group_node(cases=[build_case(case_name)])
                    output = render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)
                    assert "&lt;App /&gt; を表示する" in output

                def test_生成元_commitにdummyshaを指定したとき_生成元_commit_dummyshaの行が入る(self):
                    output = render_markdown([], commit="dummysha")
                    assert "生成元 commit: `dummysha`" in output

                def test_生成元_commitを指定しないとき_出力に生成元_commitは入らない(self):
                    output = render_markdown([], commit=None)
                    assert "生成元 commit" not in output

    class Testグループ名がグループAでケースXが1件あるとき:
        class TestMarkdown形式で出力すると:
            class Test単体テスト:
                class Test正常系:
                    @pytest.fixture
                    def output(self):
                        tree = build_group_node(
                            subgroups={"グループA": build_group_node(cases=[build_case("ケースX")])}
                        )
                        return render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)

                    def test_グループ名がグループAの見出しとして入る(self, output):
                        assert "#### グループA" in output

                    def test_ケースの名前がケースXの箇条書きの項目として入る(self, output):
                        assert "- ケースX" in output

    class TestグループがグループAとグループBの2段の入れ子で_内側のグループBの下にケースXが1件あるとき:
        class TestMarkdown形式で出力すると:
            class Test単体テスト:
                class Test正常系:
                    @pytest.fixture
                    def output(self):
                        tree = build_group_node(
                            subgroups={
                                "グループA": build_group_node(
                                    subgroups={"グループB": build_group_node(cases=[build_case("ケースX")])}
                                )
                            }
                        )
                        return render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)

                    def test_内側のグループ名がグループBの太字の項目として入る(self, output):
                        assert "- **グループB**" in output

                    def test_ケースの名前が_内側のグループ名より1段深いケースXの箇条書きの項目として入る(self, output):
                        assert "  - ケースX" in output.splitlines()


class Test運用__テスト観点カタログ__HTML形式の出力:
    class TestHTML形式で出力すると:
        class Test単体テスト:
            class Test正常系:
                def test_ページの言語は日本語になる(self):
                    output = render_html([], commit=None)
                    assert '<html lang="ja">' in output

                def test_セクション直下にケースXが1件あるとき_ケースXが箇条書きの項目として入る(self):
                    tree = build_group_node(cases=[build_case("ケースX")])
                    output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
                    assert "<li>ケースX</li>" in output

                def test_本カタログは自動テストのテスト名から生成したで始まる注意書きが入る(self):
                    output = render_html([], commit=None)
                    assert "本カタログは自動テストのテスト名から生成した" in output

                def test_生成元_commitにdummyshaを指定したとき_dummyshaがコード表示で入る(self):
                    output = render_html([], commit="dummysha")
                    assert "<code>dummysha</code>" in output

                def test_カテゴリ外から見た振る舞いのセクションの次にカテゴリ内部の挙動のセクションが続くとき_外から見た振る舞いと内部の挙動の見出しが入る(
                    self,
                ):
                    tree = build_group_node(cases=[build_case("ケースX")])
                    output = render_html(
                        [
                            ("外から見た振る舞い", "backend API の振る舞い", tree),
                            ("内部の挙動", "backend 内部部品の検証", tree),
                        ],
                        commit=None,
                    )
                    assert "<h2>外から見た振る舞い</h2>" in output
                    assert "<h2>内部の挙動</h2>" in output

                def test_セクション直下にケースが無く_グループAの下にケースXだけがあるとき_グループAの折りたたみ表示はケースの箇条書きの中に入らない(
                    self,
                ):
                    tree = build_group_node(
                        subgroups={"グループA": build_group_node(cases=[build_case("ケースX")])}
                    )
                    output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
                    assert "<ul><details>" not in output
                    assert "<ul>\n<details>" not in output

                def test_グループがグループAとグループBの2段の入れ子で_内側のグループBの下にケースXが1件あるとき_グループBの折りたたみ表示がグループAの折りたたみ表示の中に入る(
                    self,
                ):
                    tree = build_group_node(
                        subgroups={
                            "グループA": build_group_node(
                                subgroups={"グループB": build_group_node(cases=[build_case("ケースX")])}
                            )
                        }
                    )
                    output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
                    outer_start = output.index("<details><summary>グループA")
                    inner_start = output.index("<details><summary>グループB")
                    inner_end = output.index("</details>", inner_start)
                    outer_end = output.index("</details>", inner_end + 1)
                    assert outer_start < inner_start < inner_end < outer_end

                def test_トップレベルのグループ_グループBのケース1_続けてグループAのケース2の順に入力したとき_グループA_グループBの順に並ぶ(
                    self,
                ):
                    tree = build_group_node(
                        subgroups={
                            "グループB": build_group_node(cases=[build_case("ケース1")]),
                            "グループA": build_group_node(cases=[build_case("ケース2")]),
                        }
                    )
                    output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
                    assert output.index("グループA（全") < output.index("グループB（全")

                def test_トップレベルのグループが本体_その下にログイン画面_とその他_その下にヘッダー_のとき_本体_その他の順に並ぶ(
                    self,
                ):
                    tree = build_group_node(
                        subgroups={
                            "本体": build_group_node(
                                subgroups={"ログイン画面": build_group_node(cases=[build_case("ケース1")])}
                            ),
                            "その他": build_group_node(
                                subgroups={"ヘッダー": build_group_node(cases=[build_case("ケース2")])}
                            ),
                        }
                    )
                    output = render_html([("外から見た振る舞い", "frontend", tree)], commit=None)
                    assert output.index("本体（全") < output.index("その他（全")

                def test_skipされたケースXのとき_ケースXがskip_中のため未検証の注記付きで区別表示の項目として入る(self):
                    tree = build_group_node(cases=[build_case("ケースX", is_skipped=True)])
                    output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
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
                    tree = build_group_node(cases=[build_case(case_name)])
                    output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
                    assert "&lt;App /&gt; を表示する" in output

    class Testグループ名がグループAでケース1とケース2が2件あるとき:
        class TestHTML形式で出力すると:
            class Test単体テスト:
                class Test正常系:
                    @pytest.fixture
                    def output(self):
                        tree = build_group_node(
                            subgroups={"グループA": build_group_node(cases=[build_case("ケース1"), build_case("ケース2")])}
                        )
                        return render_html([("外から見た振る舞い", "backend", tree)], commit=None)

                    def test_グループがグループA全_2_ケースのケース数の注記付きの折りたたみ表示の見出しとして入る(
                        self, output
                    ):
                        assert "<details><summary>グループA（全 2 ケース）</summary>" in output

                    def test_ケース1とケース2が箇条書きの項目として入る(self, output):
                        assert "<li>ケース1</li>" in output
                        assert "<li>ケース2</li>" in output


class Test運用__テスト観点カタログ__セクション指定の形式:
    class Test外から見た振る舞いとbackendとjunitをコロン区切りの3要素で指定したとき:
        class Testセクション指定を解釈すると:
            class Test単体テスト:
                class Test正常系:
                    @pytest.fixture
                    def spec(self):
                        return parse_section_arg("外から見た振る舞い:backend:junit")

                    def test_カテゴリは外から見た振る舞いになる(self, spec):
                        assert spec.category == "外から見た振る舞い"

                    def test_セクション名はbackendになる(self, spec):
                        assert spec.label == "backend"

                    def test_JUnit_XMLのパスはjunitになる(self, spec):
                        assert str(spec.path) == "junit"

                    def test_プレフィクスは指定なしになる(self, spec):
                        assert spec.prefixes is None

    class Testセクション指定を解釈すると:
        class Test単体テスト:
            class Test正常系:
                @pytest.mark.parametrize(
                    ("value", "expected_prefixes"),
                    [
                        pytest.param(
                            "内部の挙動:backend 内部部品の検証:a/b.xml:src/domain/,src/service/",
                            ("src/domain/", "src/service/"),
                            id="4 要素目にカンマ区切りで「src/domain/,src/service/」を指定したとき (指定全体は「内部の挙動:backend 内部部品の検証:a/b.xml:src/domain/,src/service/」)、プレフィクスは「src/domain/」「src/service/」の 2 つに分かれる",
                        ),
                    ],
                )
                def test_parse_section_arg_splits_prefixes_by_comma(self, value, expected_prefixes):
                    assert parse_section_arg(value).prefixes == expected_prefixes

            class Test異常系:
                @pytest.mark.parametrize(
                    "value",
                    [
                        pytest.param("外から見た振る舞い:backend", id="指定が「外から見た振る舞い:backend」(コロンが 1 つ) のとき、指定の形式を示すエラーになる"),
                        pytest.param(":backend:a/b.xml", id="指定が「:backend:a/b.xml」(カテゴリが空) のとき、指定の形式を示すエラーになる"),
                        pytest.param(
                            "外から見た振る舞い::a/b.xml",
                            id="指定が「外から見た振る舞い::a/b.xml」(セクション名が空) のとき、指定の形式を示すエラーになる",
                        ),
                        pytest.param(
                            "外から見た振る舞い:backend:",
                            id="指定が「外から見た振る舞い:backend:」(JUnit XMLのパスが空) のとき、指定の形式を示すエラーになる",
                        ),
                    ],
                )
                def test_parse_section_arg_rejects_malformed_value(self, value):
                    with pytest.raises(argparse.ArgumentTypeError, match="の形式で指定してください"):
                        parse_section_arg(value)

                @pytest.mark.parametrize(
                    "value",
                    [
                        pytest.param(
                            "外から見た振る舞い:backend:a/b.xml:",
                            id="4 要素目が空文字の指定「外から見た振る舞い:backend:a/b.xml:」のとき、「プレフィクスが空です」というプレフィクスが空であることを示すエラーになる",
                        ),
                    ],
                )
                def test_parse_section_arg_rejects_empty_prefix(self, value):
                    with pytest.raises(argparse.ArgumentTypeError, match="プレフィクスが空です"):
                        parse_section_arg(value)


class Test運用__テスト観点カタログ__生成コマンド:
    class TestMarkdown形式とセクション指定と生成元_commitを指定し_JUnit_XMLにグループAのケースXが1件あるとき:
        class Testコマンドを実行すると:
            class Testインフラ結合テスト:
                class Test正常系:
                    @pytest.fixture
                    def output(self, tmp_path, capsys):
                        path = write_junit_xml(
                            tmp_path,
                            '<testsuite name="dummy.test.ts">' + build_case_xml("グループA &gt; ケースX") + "</testsuite>",
                        )
                        main(
                            [
                                "--format",
                                "markdown",
                                "--section",
                                f"外から見た振る舞い:backend:{path}",
                                "--commit",
                                "dummysha",
                            ]
                        )
                        return capsys.readouterr().out

                    def test_標準出力にページの題名_pokelingual_テスト観点カタログが入る(self, output):
                        assert "# pokelingual テスト観点カタログ" in output

                    def test_標準出力に_指定したカテゴリが見出し外から見た振る舞いとして入る(self, output):
                        assert "## 外から見た振る舞い" in output

                    def test_標準出力に_指定したセクション名とケース総数が見出しbackend全_1_ケースとして入る(self, output):
                        assert "### backend（全 1 ケース）" in output

                    def test_標準出力に_JUnit_XMLのケースがケースXの箇条書きの項目として入る(self, output):
                        assert "- ケースX" in output

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
                        main(["--format", "markdown", "--section", f"外から見た振る舞い:backend:{missing}"])

    class Testインフラ結合テスト:
        class Test異常系:
            def test_JUnit_XMLのパスが存在せずファイルが見つからないエラーで停止したあと_そのパスにJUnit_XMLを置いて再実行すると_標準出力にケースXの箇条書きの項目が入る(
                self, tmp_path, capsys
            ):
                path = tmp_path / "junit.xml"
                arguments = ["--format", "markdown", "--section", f"外から見た振る舞い:backend:{path}"]
                with pytest.raises(FileNotFoundError):
                    main(arguments)

                write_junit_xml(tmp_path, '<testsuite name="dummy.test.ts">' + build_case_xml("ケースX") + "</testsuite>")
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
                            id="トップレベルのグループ名が「[クエスト:出題] 出題」(最初の項目が区分でない) のとき、区分の候補「外部連携」「本体」「運用」を示すエラーになる",
                        ),
                    ],
                )
                def test_extract_top_level_tag_rejects_first_item_that_is_not_category(self, chain):
                    with pytest.raises(ValueError, match="外部連携・本体・運用 のいずれかにしてください"):
                        extract_top_level_tag(chain)
