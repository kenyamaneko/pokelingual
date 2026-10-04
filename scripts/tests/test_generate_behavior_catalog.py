import argparse

import pytest

from generate_behavior_catalog import (
    BehaviorCase,
    GroupNode,
    SectionSpec,
    build_group_tree,
    build_sections,
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


class Testテスト観点カタログ__テスト名の分解:
    class Test正常系:
        @pytest.mark.parametrize(
            ("raw_name", "expected_chain", "expected_case"),
            [
                pytest.param(
                    "ケースX",
                    (),
                    "ケースX",
                    id="区切りが無いとき、グループは無く全体がケース名になる",
                ),
                pytest.param(
                    "グループA > ケースX",
                    ("グループA",),
                    "ケースX",
                    id="Vitestの区切り「 > 」が1つのとき、前半がグループ、後半がケース名になる",
                ),
                pytest.param(
                    "グループA > グループB > ケースX",
                    ("グループA", "グループB"),
                    "ケースX",
                    id="Vitestの区切りが2つのとき、最後の要素がケース名になり、手前の2要素が外側から順に入れ子のグループになる",
                ),
                pytest.param(
                    "グループA › ケースX",
                    ("グループA",),
                    "ケースX",
                    id="Playwrightの区切り「 › 」が1つのとき、前半がグループ、後半がケース名になる",
                ),
                pytest.param(
                    "a->b の変換",
                    (),
                    "a->b の変換",
                    id="ケース名に空白を伴わない「>」を含むとき、区切りとみなされず全体がケース名になる",
                ),
            ],
        )
        def test_テスト名をグループとケース名に分ける(self, raw_name, expected_chain, expected_case):
            assert split_test_name(raw_name) == (expected_chain, expected_case)


class Testテスト観点カタログ__トップレベルのタグ抽出:
    class Test正常系:
        @pytest.mark.parametrize(
            ("chain", "expected"),
            [
                pytest.param((), (), id="グループが無いとき、結果は空になる"),
                pytest.param(
                    ("グループA",),
                    ("その他", "グループA"),
                    id="トップレベルのグループ名にタグが無いとき、タグ「その他」とそのグループ名の入れ子になる",
                ),
                pytest.param(
                    ("[認証系] ログイン画面",),
                    ("認証系", "ログイン画面"),
                    id="トップレベルのグループ名の先頭に空白区切りのタグがあるとき、そのタグと、タグを取り除いたグループ名の入れ子になる",
                ),
                pytest.param(
                    ("[認証系]ログイン画面",),
                    ("認証系", "ログイン画面"),
                    id="タグの直後に空白が無いときも、そのタグと、タグを取り除いたグループ名の入れ子になる",
                ),
                pytest.param(
                    ("[認証系] ログイン画面", "[サブ] 入力欄"),
                    ("認証系", "ログイン画面", "[サブ] 入力欄"),
                    id="グループが2段あり2段目の名前の先頭にもタグがあるとき、2段目はタグとして取り出されず名前のまま残る",
                ),
            ],
        )
        def test_トップレベルのグループ名からタグを取り出す(self, chain, expected):
            assert extract_top_level_tag(chain) == expected

    class Test異常系:
        def test_トップレベルのグループ名の先頭の角括弧が閉じていないとき_その他のタグの下にグループ名がそのまま入る(self):
            assert extract_top_level_tag(("[認証系 ログイン画面",)) == ("その他", "[認証系 ログイン画面")


class Testテスト観点カタログ__トップレベルのタグ有無の判定:
    class Test正常系:
        @pytest.mark.parametrize(
            ("chain", "expected"),
            [
                pytest.param((), False, id="グループが無いとき、タグ無しになる"),
                pytest.param(("グループA",), False, id="トップレベルのグループ名にタグが無いとき、タグ無しになる"),
                pytest.param(("[認証系] ログイン画面",), True, id="トップレベルのグループ名にタグがあるとき、タグ有りになる"),
            ],
        )
        def test_タグの有無を判定する(self, chain, expected):
            assert has_top_level_tag(chain) == expected


class Testテスト観点カタログ__タグ見出しの並び順:
    class Test正常系:
        @pytest.mark.parametrize(
            ("tags", "expected_order"),
            [
                pytest.param(
                    ["その他", "認証系"],
                    ["認証系", "その他"],
                    id="タグ名が「その他」より文字コード順で後ろのとき、「その他」が最後になる",
                ),
                pytest.param(
                    ["認証系", "ヘッダー系"],
                    ["ヘッダー系", "認証系"],
                    id="「その他」以外のタグが複数あるとき、タグ名順に並ぶ",
                ),
            ],
        )
        def test_タグを並べ替える(self, tags, expected_order):
            assert sorted(tags, key=tag_sort_key) == expected_order


class Testテスト観点カタログ__JUnit_XMLの読み取り:
    class Test正常系:
        def test_テスト結果が0件のとき_ケースの一覧が空になる(self, tmp_path):
            path = write_junit_xml(tmp_path, '<testsuite name="dummy.test.ts"></testsuite>')
            assert parse_junit_file(path) == []

        def test_テスト結果が2件のとき_記録された順にケースとして読み取られる(self, tmp_path):
            path = write_junit_xml(
                tmp_path,
                '<testsuite name="dummy.test.ts">'
                + build_case_xml("グループA &gt; ケース1")
                + build_case_xml("グループA &gt; ケース2")
                + "</testsuite>",
            )
            assert parse_junit_file(path) == [
                BehaviorCase(("グループA",), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
                BehaviorCase(("グループA",), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
            ]

        def test_skipされたテスト結果のとき_ケースがskip中として読み取られる(self, tmp_path):
            path = write_junit_xml(
                tmp_path,
                '<testsuite name="dummy.test.ts">' + build_case_xml("ケースX", is_skipped=True) + "</testsuite>",
            )
            assert parse_junit_file(path) == [
                BehaviorCase((), "ケースX", is_skipped=True, source_file="dummy.test.ts")
            ]

        def test_テスト結果にテストファイルのパスが記されているとき_そのパスがケースのテストファイルのパスになる(
            self, tmp_path
        ):
            path = write_junit_xml(
                tmp_path,
                '<testsuite name="dummy.test.ts">'
                + build_case_xml("ケースX", classname="src/router/router.test.ts")
                + "</testsuite>",
            )
            assert parse_junit_file(path)[0].source_file == "src/router/router.test.ts"

    class Test異常系:
        def test_テスト結果にテスト名が無いとき_テスト名が無いことを示すエラーになる(self, tmp_path):
            path = write_junit_xml(tmp_path, '<testsuite name="dummy.test.ts"><testcase/></testsuite>')
            with pytest.raises(ValueError, match="testcase に name 属性がありません"):
                parse_junit_file(path)

        def test_テスト結果にテストファイルのパスが無いとき_テストファイルのパスが無いことを示すエラーになる(
            self, tmp_path
        ):
            path = write_junit_xml(tmp_path, '<testsuite name="dummy.test.ts"><testcase name="ケースX"/></testsuite>')
            with pytest.raises(ValueError, match="testcase に classname 属性がありません"):
                parse_junit_file(path)


class Testテスト観点カタログ__ケースのグループ分け:
    class Test正常系:
        def test_同じ名前のグループに属するケースが2件あるとき_そのグループの下に2件のケースが読み取った順に並ぶ(
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

        def test_グループに属さないケースが1件のとき_そのケースだけが最上位に置かれる(self):
            tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=False, source_file="dummy.test.ts")])
            assert [case.case_name for case in tree.cases] == ["ケースX"]
            assert tree.subgroups == {}

        def test_グループが2段に入れ子のとき_ケースは内側のグループの下に置かれる(self):
            tree = build_group_tree(
                [BehaviorCase(("グループA", "グループB"), "ケースX", is_skipped=False, source_file="dummy.test.ts")]
            )
            inner = tree.subgroups["グループA"].subgroups["グループB"]
            assert [case.case_name for case in inner.cases] == ["ケースX"]


class Testテスト観点カタログ__ケース数の集計:
    class Test正常系:
        def test_ケースが0件のとき_ケース数は0になる(self):
            assert count_cases(GroupNode()) == 0

        def test_ケースが最上位に1件あるとき_ケース数は1になる(self):
            tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=False, source_file="dummy.test.ts")])
            assert count_cases(tree) == 1

        def test_ケースが最上位と1段目のグループと2段目のグループに1件ずつあるとき_ケース数は3になる(self):
            tree = build_group_tree(
                [
                    BehaviorCase((), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
                    BehaviorCase(("グループA",), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
                    BehaviorCase(("グループA", "グループB"), "ケース3", is_skipped=False, source_file="dummy.test.ts"),
                ]
            )
            assert count_cases(tree) == 3


class Testテスト観点カタログ__セクションへの振り分け:
    class Test正常系:
        def test_プレフィクスの指定が無いセクションが1件のとき_全ケースがそのセクションに振り分けられる(self):
            spec = SectionSpec("外から見た振る舞い", "frontend", "junit.xml", prefixes=None)
            cases = [BehaviorCase((), "ケースX", is_skipped=False, source_file="src/App.test.tsx")]
            assert route_cases_to_specs([spec], cases) == {spec: cases}

        def test_ケースのテストファイルのパスがセクションのプレフィクスで始まるとき_そのセクションに振り分けられる(
            self,
        ):
            router_spec = SectionSpec(
                "外から見た振る舞い", "backend API の振る舞い", "junit.xml", prefixes=("src/router/",)
            )
            domain_spec = SectionSpec("内部の挙動", "backend 内部部品の検証", "junit.xml", prefixes=("src/domain/",))
            router_case = BehaviorCase(
                (), "ルーティングの検証", is_skipped=False, source_file="src/router/router.test.ts"
            )
            domain_case = BehaviorCase(
                (), "除外の判定", is_skipped=False, source_file="src/domain/exclusion.test.ts"
            )

            result = route_cases_to_specs([router_spec, domain_spec], [router_case, domain_case])

            assert result[router_spec] == [router_case]
            assert result[domain_spec] == [domain_case]

    class Test異常系:
        def test_どのセクションのプレフィクスにも一致しないテストファイルのパスがあるとき_振り分け先が無いことを示すエラーになる(
            self,
        ):
            router_spec = SectionSpec(
                "外から見た振る舞い", "backend API の振る舞い", "junit.xml", prefixes=("src/router/",)
            )
            unrouted_case = BehaviorCase(
                (), "設定の検証", is_skipped=False, source_file="src/config/config.test.ts"
            )

            with pytest.raises(ValueError, match="どのセクションにも振り分けられない"):
                route_cases_to_specs([router_spec], [unrouted_case])

        def test_複数のセクションのプレフィクスに一致するテストファイルのパスがあるとき_振り分け先が複数あることを示すエラーになる(
            self,
        ):
            outer_spec = SectionSpec("外から見た振る舞い", "セクションA", "junit.xml", prefixes=("src/",))
            inner_spec = SectionSpec("内部の挙動", "セクションB", "junit.xml", prefixes=("src/domain/",))
            ambiguous_case = BehaviorCase(
                (), "除外の判定", is_skipped=False, source_file="src/domain/exclusion.test.ts"
            )

            with pytest.raises(ValueError, match="複数のセクションに振り分けられる"):
                route_cases_to_specs([outer_spec, inner_spec], [ambiguous_case])


class Testテスト観点カタログ__セクションの組み立て:
    class Test正常系:
        class Test同じJUnit_XMLを参照する2つのセクションにプレフィクスを指定したとき:
            @pytest.fixture
            def sections(self, tmp_path):
                path = write_junit_xml(
                    tmp_path,
                    '<testsuite name="dummy">'
                    + build_case_xml("ケースA", classname="src/router/router.test.ts")
                    + build_case_xml("ケースB", classname="src/domain/exclusion.test.ts")
                    + "</testsuite>",
                )
                specs = [
                    SectionSpec("外から見た振る舞い", "backend API の振る舞い", path, prefixes=("src/router/",)),
                    SectionSpec("内部の挙動", "backend 内部部品の検証", path, prefixes=("src/domain/",)),
                ]
                return build_sections(specs)

            def test_指定したカテゴリとセクション名のセクションが指定順に組み上がる(self, sections):
                assert [(category, label) for category, label, _ in sections] == [
                    ("外から見た振る舞い", "backend API の振る舞い"),
                    ("内部の挙動", "backend 内部部品の検証"),
                ]

            def test_各セクションにはそのプレフィクスで始まるテストファイルのパスのケースだけが入る(self, sections):
                assert [case.case_name for case in sections[0][2].cases] == ["ケースA"]
                assert [case.case_name for case in sections[1][2].cases] == ["ケースB"]

        def test_同じカテゴリのセクションが間に別のカテゴリを挟んで指定されたとき_そのカテゴリのセクションが続けて並ぶ(
            self, tmp_path
        ):
            def write_case_junit_xml(filename):
                xml_path = tmp_path / filename
                xml_path.write_text(
                    '<?xml version="1.0" encoding="UTF-8"?><testsuites>'
                    f'<testsuite name="dummy">{build_case_xml("ケースX")}</testsuite></testsuites>',
                    encoding="utf-8",
                )
                return xml_path

            specs = [
                SectionSpec("外から見た振る舞い", "backend", write_case_junit_xml("backend.xml"), prefixes=None),
                SectionSpec(
                    "内部の挙動", "backend 内部部品の検証", write_case_junit_xml("internal.xml"), prefixes=None
                ),
                SectionSpec("外から見た振る舞い", "frontend", write_case_junit_xml("frontend.xml"), prefixes=None),
            ]

            sections = build_sections(specs)

            assert [(category, label) for category, label, _ in sections] == [
                ("外から見た振る舞い", "backend"),
                ("外から見た振る舞い", "frontend"),
                ("内部の挙動", "backend 内部部品の検証"),
            ]

        class Test同じタグのグループが2つのテストファイルにあり_タグの無いグループも1つあるとき:
            @pytest.fixture
            def tree(self, tmp_path):
                path = write_junit_xml(
                    tmp_path,
                    '<testsuite name="dummy">'
                    + build_case_xml(
                        "[認証系] ログイン画面 &gt; ケース1",
                        classname="src/pages/LoginPage.test.tsx",
                    )
                    + build_case_xml(
                        "[認証系] 新規登録画面 &gt; ケース2",
                        classname="src/pages/SignupPage.test.tsx",
                    )
                    + build_case_xml("ヘッダー &gt; ケース3", classname="src/components/Header.test.tsx")
                    + "</testsuite>",
                )
                specs = [SectionSpec("外から見た振る舞い", "frontend", path, prefixes=None)]
                return build_sections(specs)[0][2]

            def test_同じタグの見出しの下に2つのグループが集約される(self, tree):
                assert set(tree.subgroups) == {"認証系", "その他"}
                assert set(tree.subgroups["認証系"].subgroups) == {"ログイン画面", "新規登録画面"}

            def test_タグの無いグループはその他の見出しの下にまとまる(self, tree):
                assert set(tree.subgroups) == {"認証系", "その他"}
                assert set(tree.subgroups["その他"].subgroups) == {"ヘッダー"}

        def test_タグのあるグループが1つも無いとき_トップレベルのグループ名がそのままセクション直下に並ぶ(
            self, tmp_path
        ):
            path = write_junit_xml(
                tmp_path,
                '<testsuite name="dummy">'
                + build_case_xml("API 認証 &gt; ケース1", classname="src/middleware/auth.test.ts")
                + build_case_xml("レート制限 &gt; ケース2", classname="src/middleware/rate-limit.test.ts")
                + "</testsuite>",
            )
            specs = [SectionSpec("外から見た振る舞い", "backend（API仕様）", path, prefixes=None)]

            tree = build_sections(specs)[0][2]

            assert set(tree.subgroups) == {"API 認証", "レート制限"}


class Testテスト観点カタログ__Markdown形式の出力:
    class Test正常系:
        def test_注意書きが引用として入る(self):
            output = render_markdown([], commit=None)
            disclaimer_line = next(
                line for line in output.splitlines() if "本カタログは自動テストのテスト名から生成した" in line
            )
            assert disclaimer_line.startswith("> ")

        def test_セクションにケースが2件あるとき_セクション見出しにケース総数として2が入る(self):
            tree = build_group_tree(
                [
                    BehaviorCase(("グループA",), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
                    BehaviorCase(("グループA",), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
                ]
            )
            output = render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)
            assert "### backend（全 2 ケース）" in output

        def test_同じカテゴリのセクションが連続するとき_カテゴリの見出しは1回だけ入る(self):
            tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=False, source_file="dummy.test.ts")])
            output = render_markdown(
                [
                    ("外から見た振る舞い", "backend", tree),
                    ("外から見た振る舞い", "frontend", tree),
                ],
                commit=None,
            )
            assert output.count("## 外から見た振る舞い") == 1

        def test_カテゴリが異なるセクションが続くとき_カテゴリごとの見出しが指定順に入る(self):
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

        class Testグループの下にケースが1件あるとき:
            @pytest.fixture
            def output(self):
                tree = build_group_tree(
                    [BehaviorCase(("グループA",), "ケースX", is_skipped=False, source_file="dummy.test.ts")]
                )
                return render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)

            def test_グループ名が見出しとして入る(self, output):
                assert "#### グループA" in output

            def test_ケース名が箇条書きの項目として入る(self, output):
                assert "- ケースX" in output

        class Testグループが2段に入れ子で_内側のグループの下にケースが1件あるとき:
            @pytest.fixture
            def output(self):
                tree = build_group_tree(
                    [
                        BehaviorCase(
                            ("グループA", "グループB"), "ケースX", is_skipped=False, source_file="dummy.test.ts"
                        )
                    ]
                )
                return render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)

            def test_内側のグループ名が太字の項目として入る(self, output):
                assert "- **グループB**" in output

            def test_ケース名が内側のグループ名より1段深い箇条書きの項目として入る(self, output):
                assert "  - ケースX" in output

        def test_トップレベルのグループが名前順の逆に入力されたとき_名前順に見出しが並ぶ(self):
            tree = build_group_tree(
                [
                    BehaviorCase(("グループB",), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
                    BehaviorCase(("グループA",), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
                ]
            )
            output = render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)
            assert output.index("#### グループA") < output.index("#### グループB")

        def test_タグ名がその他より文字コード順で後ろのとき_その他が最後の見出しになる(self):
            tree = build_group_tree(
                [
                    BehaviorCase(("認証系", "ログイン画面"), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
                    BehaviorCase(("その他", "ヘッダー"), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
                ]
            )
            output = render_markdown([("外から見た振る舞い", "frontend", tree)], commit=None)
            assert output.index("#### 認証系") < output.index("#### その他")

        def test_skipされたケースのとき_ケース名の後ろに未検証の注記が付く(self):
            tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=True, source_file="dummy.test.ts")])
            output = render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)
            assert "- ケースX（skip 中のため未検証）" in output

        def test_ケース名に山括弧を含むとき_タグと解釈されないよう実体参照に変換されて出力される(self):
            tree = build_group_tree(
                [BehaviorCase((), "<App /> を表示する", is_skipped=False, source_file="dummy.test.ts")]
            )
            output = render_markdown([("外から見た振る舞い", "backend", tree)], commit=None)
            assert "&lt;App /&gt; を表示する" in output
            assert "<App />" not in output

        def test_commitを指定したとき_生成元commitの行にその値が入る(self):
            output = render_markdown([], commit="dummysha")
            assert "生成元 commit: `dummysha`" in output

        def test_commitを指定しないとき_生成元commitの行は入らない(self):
            output = render_markdown([], commit=None)
            assert "生成元 commit" not in output


class Testテスト観点カタログ__HTML形式の出力:
    class Test正常系:
        def test_ページの言語が日本語になる(self):
            tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=False, source_file="dummy.test.ts")])
            output = render_html([("外から見た振る舞い", "backend", tree)], commit="dummysha")
            assert '<html lang="ja">' in output

        def test_ケース名が箇条書きの項目として入る(self):
            tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=False, source_file="dummy.test.ts")])
            output = render_html([("外から見た振る舞い", "backend", tree)], commit="dummysha")
            assert "<li>ケースX</li>" in output

        def test_注意書きが入る(self):
            tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=False, source_file="dummy.test.ts")])
            output = render_html([("外から見た振る舞い", "backend", tree)], commit="dummysha")
            assert "本カタログは自動テストのテスト名から生成した" in output

        def test_commitを指定したとき_生成元commitがコード表示で入る(self):
            tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=False, source_file="dummy.test.ts")])
            output = render_html([("外から見た振る舞い", "backend", tree)], commit="dummysha")
            assert "<code>dummysha</code>" in output

        def test_カテゴリが異なるセクションが続くとき_カテゴリごとの見出しが入る(self):
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

        class Testグループの下にケースが2件あるとき:
            @pytest.fixture
            def output(self):
                tree = build_group_tree(
                    [
                        BehaviorCase(("グループA",), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
                        BehaviorCase(("グループA",), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
                    ]
                )
                return render_html([("外から見た振る舞い", "backend", tree)], commit=None)

            def test_グループはケース数の注記を付けた折りたたみ表示の見出しとして入る(self, output):
                assert "<details><summary>グループA（全 2 ケース）</summary>" in output

            def test_ケースが箇条書きの項目として入る(self, output):
                assert "<li>ケース1</li>" in output
                assert "<li>ケース2</li>" in output

        def test_セクション直下にケースが無くグループだけがあるとき_グループの折りたたみ表示はケースの箇条書きの中に入らない(
            self,
        ):
            tree = build_group_tree(
                [BehaviorCase(("グループA",), "ケースX", is_skipped=False, source_file="dummy.test.ts")]
            )
            output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
            assert "<ul><details>" not in output
            assert "<ul>\n<details>" not in output

        def test_グループが2段に入れ子のとき_内側のグループの折りたたみ表示が外側のグループの折りたたみ表示の中に入る(
            self,
        ):
            tree = build_group_tree(
                [BehaviorCase(("グループA", "グループB"), "ケースX", is_skipped=False, source_file="dummy.test.ts")]
            )
            output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
            outer_start = output.index("<details><summary>グループA")
            inner_start = output.index("<details><summary>グループB")
            inner_end = output.index("</details>", inner_start)
            outer_end = output.index("</details>", inner_end + 1)
            assert outer_start < inner_start < inner_end < outer_end

        def test_トップレベルのグループが名前順の逆に入力されたとき_名前順に並ぶ(self):
            tree = build_group_tree(
                [
                    BehaviorCase(("グループB",), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
                    BehaviorCase(("グループA",), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
                ]
            )
            output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
            assert output.index("グループA（全") < output.index("グループB（全")

        def test_タグ名がその他より文字コード順で後ろのとき_その他が最後の見出しになる(self):
            tree = build_group_tree(
                [
                    BehaviorCase(("認証系", "ログイン画面"), "ケース1", is_skipped=False, source_file="dummy.test.ts"),
                    BehaviorCase(("その他", "ヘッダー"), "ケース2", is_skipped=False, source_file="dummy.test.ts"),
                ]
            )
            output = render_html([("外から見た振る舞い", "frontend", tree)], commit=None)
            assert output.index("認証系（全") < output.index("その他（全")

        def test_skipされたケースのとき_ケースが未検証の注記付きで区別表示の項目として入る(self):
            tree = build_group_tree([BehaviorCase((), "ケースX", is_skipped=True, source_file="dummy.test.ts")])
            output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
            assert '<li class="skipped">ケースX（skip 中のため未検証）</li>' in output

        def test_ケース名に山括弧を含むとき_タグと解釈されないよう実体参照に変換されて出力される(self):
            tree = build_group_tree(
                [BehaviorCase((), "<App /> を表示する", is_skipped=False, source_file="dummy.test.ts")]
            )
            output = render_html([("外から見た振る舞い", "backend", tree)], commit=None)
            assert "&lt;App /&gt; を表示する" in output


class Testテスト観点カタログ__セクション指定の解析:
    class Test正常系:
        class Testコロン区切りで3要素を指定したとき:
            @pytest.fixture
            def spec(self):
                return parse_section_arg("外から見た振る舞い:backend:a/b.xml")

            def test_カテゴリとセクション名とパスに分かれる(self, spec):
                assert (spec.category, spec.label, str(spec.path)) == (
                    "外から見た振る舞い",
                    "backend",
                    "a/b.xml",
                )

            def test_プレフィクスは指定なしになる(self, spec):
                assert spec.prefixes is None

        def test_コロン区切りの4要素目にカンマ区切りで2つのプレフィクスを指定したとき_2つのプレフィクスに分かれる(
            self,
        ):
            spec = parse_section_arg("内部の挙動:backend 内部部品の検証:a/b.xml:src/domain/,src/service/")
            assert spec.prefixes == ("src/domain/", "src/service/")

    class Test異常系:
        @pytest.mark.parametrize(
            "value",
            [
                pytest.param("外から見た振る舞い:backend", id="コロンが1つのとき、指定の形式を示すエラーになる"),
                pytest.param(":backend:a/b.xml", id="カテゴリが空のとき、指定の形式を示すエラーになる"),
                pytest.param("外から見た振る舞い::a/b.xml", id="セクション名が空のとき、指定の形式を示すエラーになる"),
                pytest.param("外から見た振る舞い:backend:", id="JUnit XMLのパスが空のとき、指定の形式を示すエラーになる"),
            ],
        )
        def test_セクション指定を解析する(self, value):
            with pytest.raises(argparse.ArgumentTypeError, match="の形式で指定してください"):
                parse_section_arg(value)

        def test_プレフィクスの指定が空文字のとき_プレフィクスが空であることを示すエラーになる(self):
            with pytest.raises(argparse.ArgumentTypeError, match="プレフィクスが空です"):
                parse_section_arg("外から見た振る舞い:backend:a/b.xml:")


class Testテスト観点カタログ__生成コマンド:
    class Test正常系:
        class TestMarkdown形式を指定して実行したとき:
            @pytest.fixture
            def output(self, tmp_path, capsys):
                path = write_junit_xml(
                    tmp_path,
                    '<testsuite name="dummy.test.ts">' + build_case_xml("グループA &gt; ケースX") + "</testsuite>",
                )
                main(["--format", "markdown", "--section", f"外から見た振る舞い:backend:{path}", "--commit", "dummysha"])
                return capsys.readouterr().out

            def test_標準出力にページの題名が入る(self, output):
                assert "# pokelingual テスト観点カタログ" in output

            def test_標準出力に指定したカテゴリが見出しとして入る(self, output):
                assert "## 外から見た振る舞い" in output

            def test_標準出力に指定したセクション名とケース総数が見出しとして入る(self, output):
                assert "### backend（全 1 ケース）" in output

            def test_標準出力にJUnit_XMLのケースが箇条書きの項目として入る(self, output):
                assert "- ケースX" in output

            def test_標準出力に指定したcommitが生成元として入る(self, output):
                assert "生成元 commit: `dummysha`" in output

    class Test異常系:
        def test_JUnit_XMLのパスが存在しないとき_ファイルが見つからないエラーで停止する(self, tmp_path):
            missing = tmp_path / "missing.xml"
            with pytest.raises(FileNotFoundError, match="missing.xml"):
                main(["--format", "markdown", "--section", f"外から見た振る舞い:backend:{missing}"])
