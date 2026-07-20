const HIRAGANA_PATTERN = /[ぁ-ゖ]/g;
const HIRAGANA_TO_KATAKANA_OFFSET = 0x60;

/**
 * ひらがなをカタカナへ変換する。ひらがな以外の文字はそのまま残す。
 * @param text 変換対象の文字列。
 * @returns カタカナへ変換した文字列。
 */
export function hiraganaToKatakana(text: string): string {
  return text.replace(HIRAGANA_PATTERN, (char) =>
    String.fromCharCode(char.charCodeAt(0) + HIRAGANA_TO_KATAKANA_OFFSET),
  );
}
