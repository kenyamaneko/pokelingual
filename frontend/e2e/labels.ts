/**
 * E2E 用の UI 文言 SSOT。各 spec での直書きを排し、コピー変更時の修正を一点に集約する。
 *
 * UI テキストの全角スペース (U+3000) は Playwright がアクセシブル名を正規化する際に
 * 半角スペースへ変換される。そのため正規表現側は任意の空白に当たる `.` を用いる
 * (例: /この.ほんやくで/ は "この ほんやくで" にマッチする)。
 */

/** getByRole("link", { name }) で参照するリンク名。 */
export const LINK = {
  startQuest: /ぼうけんに.出かける/,
  viewCollection: /ずかんを.見る/,
  logo: "PokeLingual",
  navQuest: "ぼうけん",
  navCollection: "ずかん",
  settings: "せってい",
} as const;

/** getByRole("button", { name }) で参照するボタン名。 */
export const BUTTON = {
  submitTranslation: /この.ほんやくで/,
  decideName: /きみに.きめた/,
  skip: /スキップ/,
  proceedOrSkip: /次へ.すすむ|スキップ/,
  useBall: /を.使う/,
  nextQuest: /つぎの.ぼうけんへ/,
  close: "とじる",
} as const;

/** getByText で参照する本文テキスト。 */
export const TEXT = {
  questTitle: "Who's That Pokemon?",
  damage: "ダメージ",
  professorComment: /はかせからの.コメント/,
  correct: "せいかい！",
  wrong: /はずれ/,
  captured: /つかまえたぞ/,
  escaped: /にげだした/,
  bestScore: /さいこう.スコア/,
  captureCount: /ほかく.回数/,
} as const;

/** getByPlaceholder で参照するプレースホルダ。 */
export const PLACEHOLDER = {
  translation: /日本語を.入力してね/,
  nameGuess: /ポケモンの.名前を.入力してね/,
} as const;

/** getByRole("heading", { name }) で参照する見出し。 */
export const HEADING = {
  collection: "ずかん",
} as const;
