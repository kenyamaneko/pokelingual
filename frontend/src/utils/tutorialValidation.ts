const ELECTRIC_KEYWORDS = ["電気", "でんき"];
const MOUSE_KEYWORDS = ["ネズミ", "ねずみ"];
const PIKACHU_NAMES = ["ピカチュウ", "pikachu"];

/**
 * チュートリアルの訳文入力が「電気」系・「ネズミ」系のキーワードを両方含むかを判定する。
 * @param input ユーザーが入力した訳文。
 * @returns 両方のキーワードを含んでいれば true。
 */
export function validateTutorialTranslation(input: string): boolean {
  const hasElectric = ELECTRIC_KEYWORDS.some((k) => input.includes(k));
  const hasMouse = MOUSE_KEYWORDS.some((k) => input.includes(k));
  return hasElectric && hasMouse;
}

/**
 * チュートリアルの名前入力が「ピカチュウ」または「pikachu」(大文字小文字を区別しない) と完全一致するかを判定する。
 * @param input ユーザーが入力した名前。
 * @returns 完全一致すれば true。
 */
export function validateTutorialName(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return PIKACHU_NAMES.some((name) => name.toLowerCase() === normalized);
}
