import pytest


@pytest.fixture
def record_case_items(record_property):
    """ケースの項目 (種別・正常異常・Given・When・Then) をテスト結果に載せる関数を返す。

    Returns:
        キーワード引数で項目を受け取り、種別・正常異常・Given・When・Then の順に property として載せる関数。
    """

    def record(*, kind, normality, given, when, then):
        record_property("種別", kind)
        record_property("正常異常", normality)
        record_property("Given", given)
        record_property("When", when)
        record_property("Then", then)

    return record
