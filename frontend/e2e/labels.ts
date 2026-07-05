/**
 * E2E 用の UI 文言 SSOT。各 spec での直書きを排し、コピー変更時の修正を一点に集約する。
 *
 * UI テキストの全角スペース (U+3000) は Playwright がアクセシブル名を正規化する際に
 * 半角スペースへ変換される。そのため正規表現側は任意の空白に当たる `.` を用いる
 * (例: /この.ほんやくで/ は "この ほんやくで" にマッチする)。
 */

/** getByRole("link", { name }) で参照するリンク名。 */
export const LINK = {
  startQuest: /ポケモンを探しに行く/,
  viewPokedex: /図鑑を見る/,
  logo: "PokeLingual",
  navQuest: "探検",
  navPokedex: "図鑑",
  settings: "設定",
} as const;

/** getByRole("button", { name }) で参照するボタン名。 */
export const BUTTON = {
  submitTranslation: /この翻訳に決めた/,
  decideName: /君に.決めた/,
  skip: /スキップ/,
  proceed: /次へ進む/,
  useBall: /を.使う/,
  nextQuest: /次のポケモンを探す/,
  close: "閉じる",
} as const;

/** getByText で参照する本文テキスト。 */
export const TEXT = {
  questTitle: "Who's That Pokemon?",
  damage: "ダメージ",
  professorComment: /博士からのコメント/,
  correct: "正解！",
  wrong: /はずれ/,
  wrongFinal: /残念/,
  ultraBall: /ハイパーボール/,
  pokeBall: /モンスターボール/,
  captured: /捕まえたぞ/,
  escaped: /逃げ出した/,
  bestScore: /最高スコア/,
  captureCount: /捕獲回数/,
} as const;

/** getByPlaceholder で参照するプレースホルダ。 */
export const PLACEHOLDER = {
  translation: /日本語を入力してね/,
  nameGuess: /ポケモンの名前を入力してね/,
} as const;

/** getByRole("heading", { name }) で参照する見出し。 */
export const HEADING = {
  pokedex: "図鑑",
} as const;
