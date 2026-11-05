import json
import re

import pytest

from generate_behavior_catalog import (
    CatalogCase,
    CatalogError,
    Step,
    main,
    parse_junit_file,
    parse_steps,
    parse_top_level,
    render_html,
    sort_cases,
    split_test_name,
    validate_feature,
)

FEATURES = {
    "本体": {"大機能": ["認証", "注文"], "中機能": ["画面表示", "業務ルール"]},
    "外部連携": {"大機能": ["決済代行会社"], "中機能": ["応答の変換"]},
    "運用": {"大機能": ["ログ出力"], "中機能": []},
    "シナリオ": {"大機能": ["商品を購入する"], "中機能": ["通常の動線"]},
}


def write_features(tmp_path):
    """テスト用の大機能・中機能の一覧を書き出す。

    Args:
        tmp_path: 書き出し先ディレクトリ。

    Returns:
        書き出したファイルのパス。
    """
    path = tmp_path / "features.json"
    path.write_text(json.dumps(FEATURES, ensure_ascii=False), encoding="utf-8")
    return path


def write_css(tmp_path):
    """テスト用の CSS を書き出す。

    Args:
        tmp_path: 書き出し先ディレクトリ。

    Returns:
        書き出したファイルのパス。
    """
    path = tmp_path / "catalog.css"
    path.write_text(".dummy{}", encoding="utf-8")
    return path


def build_property_xml(pairs):
    """(キー, 値) の並びを property 要素の XML 断片にする。

    Args:
        pairs: 載せる順の (キー, 値)。

    Returns:
        properties 要素の XML 断片。
    """
    items = "".join(f'<property name="{key}" value="{value}"/>' for key, value in pairs)
    return f"<properties>{items}</properties>"


def build_case_xml(name, pairs=(), is_skipped=False):
    """1 件の testcase 要素の XML 断片を組み立てる。

    Args:
        name: testcase の name 属性。
        pairs: 結果に載せる (キー, 値)。
        is_skipped: skipped 子要素を付けるかどうか。

    Returns:
        testcase 要素の XML 断片。
    """
    properties = build_property_xml(pairs) if pairs else ""
    skipped = "<skipped/>" if is_skipped else ""
    return f'<testcase classname="dummy.test.ts" name="{name}">{properties}{skipped}</testcase>'


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


LOGIN_PAIRS = [
    ("種別", "部品間結合テスト"),
    ("正常異常", "異常系"),
    ("Given", "メールアドレスが未確認のアカウントのとき"),
    ("When", "ログイン画面で「メールでログイン」を押す"),
    ("Then", "確認を促すメッセージが表示される"),
]


def build_case(region="本体", major="認証", minor="", feature="ログイン", is_skipped=False):
    """カタログに載せる 1 件のケースを組み立てる。

    Args:
        region: 区分。
        major: 大機能。
        minor: 中機能。
        feature: 小機能。
        is_skipped: skip 中のケースにするかどうか。

    Returns:
        1 ステップのケース。
    """
    return CatalogCase(region, major, minor, feature, "単体テスト", "正常系", (Step("", ("操作する",), "結果になる"),), is_skipped)


class Test運用__テスト観点カタログ__テスト名の分解:
    class Testテスト名を分解すると:
        class Test単体テスト:
            class Test正常系:
                @pytest.mark.parametrize(
                    ("raw_name", "expected_top"),
                    [
                        pytest.param(
                            "[本体:認証]ログイン > 前提のとき、操作すると、結果になる",
                            "[本体:認証]ログイン",
                            id="Vitest の区切り「 > 」を含む名前のとき、トップレベルの名前は「[本体:認証]ログイン」になる",
                        ),
                        pytest.param(
                            "[本体:認証]ログイン › 前提のとき、操作すると、結果になる",
                            "[本体:認証]ログイン",
                            id="Playwright の区切り「 › 」を含む名前のとき、トップレベルの名前は「[本体:認証]ログイン」になる",
                        ),
                    ],
                )
                def test_split_test_name_returns_top_level(self, raw_name, expected_top):
                    top, _ = split_test_name(raw_name)
                    assert top == expected_top

                @pytest.mark.parametrize(
                    ("top", "expected"),
                    [
                        pytest.param(
                            "[本体:認証]ログイン",
                            ("本体", "認証", "", "ログイン"),
                            id="トップレベルの名前が「[本体:認証]ログイン」のとき、中機能は空になる",
                        ),
                        pytest.param(
                            "[本体:注文:画面表示]送料の表示",
                            ("本体", "注文", "画面表示", "送料の表示"),
                            id="トップレベルの名前が「[本体:注文:画面表示]送料の表示」のとき、中機能は「画面表示」になる",
                        ),
                    ],
                )
                def test_parse_top_level_returns_parts(self, top, expected):
                    assert parse_top_level(top, "場所") == expected

            class Test異常系:
                def test_parse_top_level_raises_for_missing_major(self):
                    with pytest.raises(CatalogError, match="形ではありません"):
                        parse_top_level("[本体]ログイン", "場所")


class Test運用__テスト観点カタログ__ステップの組み立て:
    class Testステップを組み立てると:
        class Test単体テスト:
            class Test正常系:
                def test_parse_steps_returns_one_step(self):
                    steps = parse_steps(
                        [("Given", "前提のとき"), ("When", "操作A"), ("When", "操作B"), ("Then", "結果になる")], "場所"
                    )
                    assert steps == (Step("前提のとき", ("操作A", "操作B"), "結果になる"),)

                def test_parse_steps_returns_step_without_given(self):
                    steps = parse_steps([("When", "操作A"), ("Then", "結果になる")], "場所")
                    assert steps == (Step("", ("操作A",), "結果になる"),)

                def test_parse_steps_returns_two_steps_when_second_has_no_given(self):
                    steps = parse_steps(
                        [("Given", "前提のとき"), ("When", "操作A"), ("Then", "結果A"), ("When", "操作B"), ("Then", "結果B")],
                        "場所",
                    )
                    assert steps == (Step("前提のとき", ("操作A",), "結果A"), Step("", ("操作B",), "結果B"))

            class Test異常系:
                @pytest.mark.parametrize(
                    ("pairs", "message"),
                    [
                        pytest.param([("Given", "前提のとき"), ("Then", "結果")], "When の無い Then", id="Given のあとに When が無く Then が来たとき、When の無い Then のエラーになる"),
                        pytest.param([("Given", "前提のとき"), ("When", "操作")], "Then の無いステップ", id="Then が無いまま終わったとき、Then の無いステップのエラーになる"),
                        pytest.param([("Given", "前提A"), ("Given", "前提B")], "Then の前に Given", id="Given が続いたとき、Then の前に Given が続くエラーになる"),
                        pytest.param([], "載っていません", id="Given・When・Then が 1 つも無いとき、載っていないエラーになる"),
                    ],
                )
                def test_parse_steps_raises(self, pairs, message):
                    with pytest.raises(CatalogError, match=message):
                        parse_steps(pairs, "場所")


class Test運用__テスト観点カタログ__一覧の検証:
    class Test一覧を検証すると:
        class Test単体テスト:
            class Test正常系:
                def test_validate_feature_accepts_listed_pair(self):
                    validate_feature("本体", "注文", "画面表示", FEATURES, "場所")

            class Test異常系:
                @pytest.mark.parametrize(
                    ("region", "major", "minor", "message"),
                    [
                        pytest.param("存在しない区分", "認証", "", "のいずれでもありません", id="区分が「存在しない区分」のとき、区分のエラーになる"),
                        pytest.param("本体", "存在しない大機能", "", "一覧にありません", id="大機能が一覧に無いとき、大機能のエラーになる"),
                        pytest.param("本体", "認証", "存在しない中機能", "一覧にありません", id="中機能が一覧に無いとき、中機能のエラーになる"),
                        pytest.param("運用", "ログ出力", "画面表示", "付けられません", id="運用に中機能が付いているとき、中機能を付けられないエラーになる"),
                    ],
                )
                def test_validate_feature_raises(self, region, major, minor, message):
                    with pytest.raises(CatalogError, match=message):
                        validate_feature(region, major, minor, FEATURES, "場所")


class Test運用__テスト観点カタログ__JUnit_XMLの読み取り:
    class TestJUnit_XMLを読み取ると:
        class Test単体テスト:
            class Test正常系:
                def test_parse_junit_file_returns_case_with_properties(self, tmp_path):
                    path = write_junit_xml(tmp_path, build_case_xml("[本体:認証]ログイン > あ", LOGIN_PAIRS))
                    cases = parse_junit_file(path, FEATURES)
                    assert cases == [
                        CatalogCase(
                            "本体", "認証", "", "ログイン", "部品間結合テスト", "異常系",
                            (Step("メールアドレスが未確認のアカウントのとき", ("ログイン画面で「メールでログイン」を押す",), "確認を促すメッセージが表示される"),),
                            False,
                        )
                    ]

                def test_parse_junit_file_accepts_skipped_case_without_properties(self, tmp_path):
                    path = write_junit_xml(tmp_path, build_case_xml("[本体:認証]ログイン > あ", is_skipped=True))
                    cases = parse_junit_file(path, FEATURES)
                    assert cases[0].is_skipped is True
                    assert cases[0].steps == ()

            class Test異常系:
                def test_parse_junit_file_raises_for_case_without_properties(self, tmp_path):
                    path = write_junit_xml(tmp_path, build_case_xml("[本体:認証]ログイン > あ"))
                    with pytest.raises(CatalogError, match="種別"):
                        parse_junit_file(path, FEATURES)

                def test_parse_junit_file_raises_for_case_without_when(self, tmp_path):
                    pairs = [p for p in LOGIN_PAIRS if p[0] != "When"]
                    path = write_junit_xml(tmp_path, build_case_xml("[本体:認証]ログイン > あ", pairs))
                    with pytest.raises(CatalogError, match="When の無い Then"):
                        parse_junit_file(path, FEATURES)

                def test_parse_junit_file_raises_for_unknown_kind(self, tmp_path):
                    pairs = [("種別", "謎のテスト")] + [p for p in LOGIN_PAIRS if p[0] != "種別"]
                    path = write_junit_xml(tmp_path, build_case_xml("[本体:認証]ログイン > あ", pairs))
                    with pytest.raises(CatalogError, match="謎のテスト"):
                        parse_junit_file(path, FEATURES)


class Test運用__テスト観点カタログ__並び順:
    class Testケースを並べ替えると:
        class Test単体テスト:
            class Test正常系:
                def test_sort_cases_orders_by_region_and_major_list(self):
                    cases = [
                        build_case(region="運用", major="ログ出力", feature="A"),
                        build_case(major="注文", feature="B"),
                        build_case(major="認証", feature="C"),
                    ]
                    assert [c.feature for c in sort_cases(cases, FEATURES)] == ["C", "B", "A"]

                def test_sort_cases_puts_case_without_minor_after_cases_with_minor(self):
                    cases = [build_case(feature="A"), build_case(minor="画面表示", feature="B")]
                    assert [c.feature for c in sort_cases(cases, FEATURES)] == ["B", "A"]


class Test運用__テスト観点カタログ__HTML形式の出力:
    class TestHTMLを出力すると:
        class Test単体テスト:
            class Test正常系:
                def test_render_html_embeds_case_data(self):
                    html = render_html([build_case(feature="ログイン")], "abc123", ".dummy{}")
                    payload = json.loads(re.search(r'<script id="data" type="application/json">(.*?)</script>', html, re.S).group(1))
                    assert payload["cases"][0]["s"] == "ログイン"
                    assert payload["cases"][0]["steps"] == [{"G": "", "W": ["操作する"], "T": "結果になる"}]
                    assert payload["commit"] == "abc123"

                def test_render_html_embeds_css(self):
                    html = render_html([build_case()], None, ".css-from-tailwind{color:red}")
                    assert "<style>.css-from-tailwind{color:red}</style>" in html

                def test_render_html_escapes_markup_in_case_text(self):
                    case = CatalogCase("本体", "認証", "", "ログイン", "単体テスト", "正常系", (Step("", ("</script>を押す",), "結果"),), False)
                    html = render_html([case], None, ".dummy{}")
                    assert "</script>を押す" not in html


class Test運用__テスト観点カタログ__生成コマンド:
    class Test生成コマンドを実行すると:
        class Test部品間結合テスト:
            class Test正常系:
                def test_main_writes_html_with_case_text(self, tmp_path, capsys):
                    junit = write_junit_xml(tmp_path, build_case_xml("[本体:認証]ログイン > あ", LOGIN_PAIRS))
                    main(["--junit", str(junit), "--features", str(write_features(tmp_path)), "--css", str(write_css(tmp_path))])
                    output = capsys.readouterr().out
                    assert "<!doctype html>" in output
                    assert "メールアドレスが未確認のアカウントのとき" in output

            class Test異常系:
                def test_main_exits_with_message_for_unlisted_major(self, tmp_path):
                    junit = write_junit_xml(tmp_path, build_case_xml("[本体:存在しない]ログイン > あ", LOGIN_PAIRS))
                    with pytest.raises(SystemExit) as exit_info:
                        main(["--junit", str(junit), "--features", str(write_features(tmp_path)), "--css", str(write_css(tmp_path))])
                    assert "一覧にありません" in str(exit_info.value)
