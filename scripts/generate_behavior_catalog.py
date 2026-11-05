#!/usr/bin/env python3
"""テスト実行結果の JUnit XML から、テスト観点カタログ (HTML) を生成する。

テスト名の先頭 `[区分:大機能(:中機能)]小機能` と、ケースの結果に載せた項目
(種別・正常異常・Given・When・Then) を読み、小機能ごとの表にして標準出力へ書き出す。
シナリオテストには実行する環境のタグを付け、環境で結果が違うステップは環境ごとの結果を表に並べる。
項目が足りないケースと、一覧にない大機能・中機能の組はエラーにする。
"""

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

# テストランナーが describe 連鎖とテスト名を連結する区切り。Vitest は " > "、Playwright は " › "
NAME_SEPARATORS = (" > ", " › ")

TOP_LEVEL_PATTERN = re.compile(r"^\[([^:\]]+):([^:\]]+)(?::([^\]]+))?\](.+)$")

REGIONS = ("本体", "共通", "運用", "外部連携", "シナリオ")

# 運用は大機能の下に中機能を置かない
REGION_WITHOUT_MINOR = "運用"

KINDS = (
    "単体テスト",
    "部品間結合テスト",
    "インフラ結合テスト",
    "サービス間結合テスト",
    "E2Eテスト",
    "シナリオテスト",
)

SCENARIO_KIND = "シナリオテスト"

ENVIRONMENTS = ("ローカル", "dev環境")

OUTCOMES = ("正常系", "異常系")

PROPERTY_KIND = "種別"
PROPERTY_OUTCOME = "正常異常"
PROPERTY_GIVEN = "Given"
PROPERTY_WHEN = "When"
PROPERTY_THEN = "Then"
PROPERTY_ENVIRONMENT = "環境"
# 環境ごとに結果が違うステップは、`Then:ローカル` のように環境名を添えたキーで載せる
THEN_ENVIRONMENT_PREFIX = "Then:"

# テストの無い仕様はカタログに現れないため、「載っていない = 仕様がない」という誤読を防ぐ
DISCLAIMER = (
    "本カタログは自動テストから生成した「テスト済みの観点」の一覧であり、"
    "仕様の全量ではない。テストの無い仕様はここに現れない。"
)

PAGE_TITLE = "pokelingual テスト観点カタログ"

DEFAULT_FEATURES_PATH = Path(__file__).with_name("behavior_catalog_features.json")
TEMPLATE_PATH = Path(__file__).with_name("behavior_catalog_template.html")
DATA_PLACEHOLDER = "__DATA__"
TITLE_PLACEHOLDER = "__TITLE__"
CSS_PLACEHOLDER = "__CSS__"


class CatalogError(ValueError):
    """カタログにできないテストが見つかったことを表す。"""


@dataclass(frozen=True)
class Step:
    """ケースの 1 ステップ。

    Args:
        given: 前提。無ければ空文字。
        whens: 実行順の操作。
        then: 環境によらない結果。環境ごとに結果が違うステップでは空文字。
        then_by_environment: 環境ごとの結果。環境によらない結果のステップでは空。
    """

    given: str
    whens: tuple[str, ...]
    then: str
    then_by_environment: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True)
class CatalogCase:
    """1 件のテストケースが表す振る舞い。

    Args:
        region: 区分。
        major: 大機能。
        minor: 中機能。無ければ空文字。
        feature: 小機能。
        kind: テストの種別。skip 中のケースでは空文字のことがある。
        outcome: 正常系か異常系か。skip 中のケースでは空文字のことがある。
        steps: ステップ。skip 中のケースでは空。
        is_skipped: skip されて実行されていないケースかどうか。
        environments: 実行する環境。シナリオテストだけに付く。
    """

    region: str
    major: str
    minor: str
    feature: str
    kind: str
    outcome: str
    steps: tuple[Step, ...]
    is_skipped: bool
    environments: tuple[str, ...] = ()


def split_test_name(raw_name: str) -> tuple[str, str]:
    """JUnit の testcase 名を、トップレベルの describe 名とそれ以降に分ける。

    Args:
        raw_name: テストランナーが階層を区切り文字で連結した testcase 名。

    Returns:
        (トップレベルの describe 名, 残りの名前)。区切りが無ければ残りは空。
    """
    segments = [raw_name]
    for separator in NAME_SEPARATORS:
        segments = [part for segment in segments for part in segment.split(separator)]
    return segments[0], " > ".join(segments[1:])


def parse_top_level(top: str, where: str) -> tuple[str, str, str, str]:
    """`[区分:大機能(:中機能)]小機能` を分解する。

    Args:
        top: トップレベルの describe 名。
        where: エラー表示に使う、テストの所在。

    Returns:
        (区分, 大機能, 中機能, 小機能)。中機能が無ければ空文字。

    Raises:
        CatalogError: 形式に合わないとき。
    """
    match = TOP_LEVEL_PATTERN.match(top)
    if match is None:
        raise CatalogError(f"トップレベルの名前が [区分:大機能(:中機能)]小機能 の形ではありません: {where}")
    region, major, minor, feature = match.group(1), match.group(2), match.group(3) or "", match.group(4)
    return region, major, minor, feature


def parse_steps(properties: list[tuple[str, str]], where: str) -> tuple[Step, ...]:
    """結果に載った Given・When・Then の並びを、ステップに組み立てる。

    ステップは「Given (任意)、When (1 つ以上)、Then」で閉じる。環境ごとに結果が違うステップは、
    Then の代わりに `Then:環境名` が環境の数だけ続いて閉じる。

    Args:
        properties: 載った順の (キー, 値)。
        where: エラー表示に使う、テストの所在。

    Returns:
        ステップの並び。

    Raises:
        CatalogError: When か Then が無いステップがあるとき、または並びが不正なとき。
    """
    steps: list[Step] = []
    given, whens, open_step = "", [], False
    thens_by_environment: list[tuple[str, str]] = []

    def close_environment_step() -> None:
        nonlocal given, whens, open_step, thens_by_environment
        steps.append(Step(given, tuple(whens), "", tuple(thens_by_environment)))
        given, whens, open_step, thens_by_environment = "", [], False, []

    for key, value in properties:
        if key == PROPERTY_GIVEN:
            if thens_by_environment:
                close_environment_step()
            if open_step:
                raise CatalogError(f"Then の前に Given が続いています: {where}")
            given, whens, open_step = value, [], True
        elif key == PROPERTY_WHEN:
            if thens_by_environment:
                close_environment_step()
            if not open_step:
                given, whens, open_step = "", [], True
            whens.append(value)
        elif key == PROPERTY_THEN:
            if thens_by_environment:
                raise CatalogError(f"同じステップに Then と環境ごとの Then が混ざっています: {where}")
            if not whens:
                raise CatalogError(f"When の無い Then があります: {where}")
            steps.append(Step(given, tuple(whens), value))
            given, whens, open_step = "", [], False
        elif key.startswith(THEN_ENVIRONMENT_PREFIX):
            environment = key[len(THEN_ENVIRONMENT_PREFIX):]
            if not whens:
                raise CatalogError(f"When の無い Then があります: {where}")
            if environment not in ENVIRONMENTS:
                raise CatalogError(f"環境「{environment}」は {'・'.join(ENVIRONMENTS)} のいずれでもありません: {where}")
            if any(existing == environment for existing, _ in thens_by_environment):
                raise CatalogError(f"同じステップに環境「{environment}」の Then が 2 つあります: {where}")
            thens_by_environment.append((environment, value))
    if thens_by_environment:
        close_environment_step()
    if open_step:
        raise CatalogError(f"Then の無いステップがあります: {where}")
    if not steps:
        raise CatalogError(f"Given・When・Then が載っていません: {where}")
    return tuple(steps)


def validate_environments(kind: str, environments: tuple[str, ...], steps: tuple[Step, ...], where: str) -> tuple[Step, ...]:
    """実行する環境のタグと、環境ごとの結果を確かめ、環境の並びを一覧の順にそろえる。

    Args:
        kind: テストの種別。
        environments: 結果に載った実行環境。
        steps: ステップ。
        where: エラー表示に使う、テストの所在。

    Returns:
        環境ごとの結果を ENVIRONMENTS の順にそろえたステップ。

    Raises:
        CatalogError: 環境のタグがシナリオテスト以外にあるとき、シナリオテストに無いとき、
            環境ごとの結果がタグと食い違うとき、または環境ごとの結果が同じとき。
    """
    if kind != SCENARIO_KIND:
        if environments:
            raise CatalogError(f"環境のタグは {SCENARIO_KIND} だけに付けられます: {where}")
        if any(step.then_by_environment for step in steps):
            raise CatalogError(f"環境ごとの Then は {SCENARIO_KIND} だけに書けます: {where}")
        return steps
    if not environments:
        raise CatalogError(f"{SCENARIO_KIND} には実行する環境のタグが必要です: {where}")
    ordered = []
    for step in steps:
        if not step.then_by_environment:
            ordered.append(step)
            continue
        if {environment for environment, _ in step.then_by_environment} != set(environments):
            raise CatalogError(f"環境ごとの Then の環境が、ケースの環境のタグと一致しません: {where}")
        if len(step.then_by_environment) < 2:
            raise CatalogError(f"環境ごとの Then は、2 つ以上の環境で書きます: {where}")
        if len({text for _, text in step.then_by_environment}) < 2:
            raise CatalogError(f"環境ごとの Then が同じ内容です。Then は 1 つにします: {where}")
        sorted_thens = tuple(sorted(step.then_by_environment, key=lambda pair: ENVIRONMENTS.index(pair[0])))
        ordered.append(Step(step.given, step.whens, step.then, sorted_thens))
    return tuple(ordered)


def load_features(path: Path) -> dict[str, dict[str, list[str]]]:
    """大機能・中機能の一覧を読む。

    Args:
        path: 一覧の JSON のパス。

    Returns:
        区分ごとの、大機能の並びと中機能の並び。
    """
    return json.loads(path.read_text(encoding="utf-8"))


def validate_feature(region: str, major: str, minor: str, features: dict, where: str) -> None:
    """区分・大機能・中機能が一覧にあることを確かめる。

    Args:
        region: 区分。
        major: 大機能。
        minor: 中機能。無ければ空文字。
        features: load_features が返す一覧。
        where: エラー表示に使う、テストの所在。

    Raises:
        CatalogError: 一覧に無い組のとき、または運用に中機能が付いているとき。
    """
    if region not in REGIONS:
        raise CatalogError(f"区分「{region}」は {'・'.join(REGIONS)} のいずれでもありません: {where}")
    allowed = features[region]
    if major not in allowed["大機能"]:
        raise CatalogError(f"大機能「{major}」は区分「{region}」の一覧にありません: {where}")
    if region == REGION_WITHOUT_MINOR and minor:
        raise CatalogError(f"区分「{region}」には中機能を付けられません: {where}")
    if minor and minor not in allowed["中機能"]:
        raise CatalogError(f"中機能「{minor}」は区分「{region}」の一覧にありません: {where}")


def parse_junit_file(path: Path, features: dict) -> list[CatalogCase]:
    """JUnit XML を読み、全 testcase を CatalogCase の列に変換する。

    Args:
        path: JUnit XML ファイルのパス。
        features: load_features が返す一覧。

    Returns:
        文書順の CatalogCase のリスト。

    Raises:
        CatalogError: testcase に必要な項目が無いとき、または一覧に無いとき。
    """
    cases = []
    for testcase in ET.parse(path).getroot().iter("testcase"):
        raw_name = testcase.get("name")
        if raw_name is None:
            raise CatalogError(f"testcase に name 属性がありません: {path}")
        where = f"{path}: {raw_name}"
        top, _ = split_test_name(raw_name)
        region, major, minor, feature = parse_top_level(top, where)
        validate_feature(region, major, minor, features, where)
        is_skipped = testcase.find("skipped") is not None
        properties = [(p.get("name"), p.get("value")) for p in testcase.iter("property")]
        meta = {key: value for key, value in properties if key in (PROPERTY_KIND, PROPERTY_OUTCOME)}
        environments = tuple(value for key, value in properties if key == PROPERTY_ENVIRONMENT)
        for environment in environments:
            if environment not in ENVIRONMENTS:
                raise CatalogError(f"環境「{environment}」は {'・'.join(ENVIRONMENTS)} のいずれでもありません: {where}")
        if len(set(environments)) != len(environments):
            raise CatalogError(f"環境のタグが重複しています: {where}")
        kind, outcome = meta.get(PROPERTY_KIND, ""), meta.get(PROPERTY_OUTCOME, "")
        if is_skipped and not properties:
            cases.append(CatalogCase(region, major, minor, feature, kind, outcome, (), True, ()))
            continue
        if kind not in KINDS:
            raise CatalogError(f"種別「{kind}」は「テストの種別」のいずれでもありません: {where}")
        if outcome not in OUTCOMES:
            raise CatalogError(f"正常異常「{outcome}」は {'・'.join(OUTCOMES)} のいずれでもありません: {where}")
        step_keys = (PROPERTY_GIVEN, PROPERTY_WHEN, PROPERTY_THEN)
        steps = parse_steps([p for p in properties if p[0] in step_keys or p[0].startswith(THEN_ENVIRONMENT_PREFIX)], where)
        steps = validate_environments(kind, environments, steps, where)
        ordered_environments = tuple(environment for environment in ENVIRONMENTS if environment in environments)
        cases.append(CatalogCase(region, major, minor, feature, kind, outcome, steps, is_skipped, ordered_environments))
    return cases


def sort_cases(cases: list[CatalogCase], features: dict) -> list[CatalogCase]:
    """区分・大機能・中機能を一覧の順に並べる。同じ組の中は読み込んだ順のまま。

    Args:
        cases: 読み込んだ順のケース。
        features: load_features が返す一覧。

    Returns:
        並べ替えたケース。
    """

    def rank(case: CatalogCase) -> tuple[int, int, int]:
        allowed = features[case.region]
        minor_rank = allowed["中機能"].index(case.minor) if case.minor else len(allowed["中機能"])
        return REGIONS.index(case.region), allowed["大機能"].index(case.major), minor_rank

    return sorted(cases, key=rank)


def build_step_payload(step: Step) -> dict:
    """ステップを画面の描画に渡すデータにする。

    Args:
        step: ステップ。

    Returns:
        前提・操作・結果。環境ごとに結果が違うときは、結果の代わりに環境と結果の組の並びを持つ。
    """
    payload = {"G": step.given, "W": list(step.whens), "T": step.then}
    if step.then_by_environment:
        payload["E"] = [[environment, text] for environment, text in step.then_by_environment]
    return payload


def build_payload(cases: list[CatalogCase], commit: str | None) -> dict:
    """画面の描画に渡すデータを組み立てる。

    Args:
        cases: 並べ替え済みのケース。
        commit: 生成元 commit の SHA。None なら表示しない。

    Returns:
        JSON にできるデータ。
    """
    return {
        "title": PAGE_TITLE,
        "disclaimer": DISCLAIMER,
        "commit": commit or "",
        "regions": list(REGIONS),
        "cases": [
            {
                "k": case.region,
                "d": case.major,
                "m": case.minor,
                "s": case.feature,
                "t": case.kind,
                "n": case.outcome,
                "x": case.is_skipped,
                "e": list(case.environments),
                "steps": [build_step_payload(step) for step in case.steps],
            }
            for case in cases
        ],
    }


def render_html(cases: list[CatalogCase], commit: str | None, css: str) -> str:
    """テスト観点カタログを単一ファイルの HTML ページとして描画する。

    Args:
        cases: 並べ替え済みのケース。
        commit: 生成元 commit の SHA。None なら表示しない。
        css: ページに埋め込む、Tailwind が生成した CSS。

    Returns:
        HTML 文書全体。
    """
    payload = json.dumps(build_payload(cases, commit), ensure_ascii=False, separators=(",", ":"))
    # script 要素の中でタグと解釈されないよう、山括弧と & を文字参照ではなく JSON のエスケープにする
    payload = payload.replace("&", "\\u0026").replace("<", "\\u003c").replace(">", "\\u003e")
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    return template.replace(TITLE_PLACEHOLDER, PAGE_TITLE).replace(CSS_PLACEHOLDER, css).replace(DATA_PLACEHOLDER, payload)


def main(argv: list[str] | None = None) -> None:
    """コマンドライン引数を解釈し、カタログを標準出力へ書き出す。

    Args:
        argv: コマンドライン引数。None なら sys.argv を使う。
    """
    parser = argparse.ArgumentParser(description="JUnit XML からテスト観点カタログを生成する")
    parser.add_argument("--junit", action="append", required=True, type=Path, metavar="PATH", help="JUnit XML のパス (複数指定可)")
    parser.add_argument("--commit", default=None, help="生成元 commit の SHA (省略可)")
    parser.add_argument("--css", required=True, type=Path, help="Tailwind が生成した CSS のパス")
    parser.add_argument("--features", default=DEFAULT_FEATURES_PATH, type=Path, help="大機能・中機能の一覧の JSON")
    args = parser.parse_args(argv)

    try:
        features = load_features(args.features)
        cases = [case for path in args.junit for case in parse_junit_file(path, features)]
        css = args.css.read_text(encoding="utf-8")
        sys.stdout.write(render_html(sort_cases(cases, features), args.commit, css))
    except CatalogError as error:
        sys.exit(str(error))


if __name__ == "__main__":
    main()
