// 値は本番の既定値と一致するが、.env.tuning からは読み込まず独立して定義する。
// 運用チューニングの変更がテストの前提に波及しないようにするため。
/** テスト用の、除外可能ポケモン数の上限。 */
export const DEFAULT_MAX_EXCLUDED_POKEMON_COUNT = 30;
