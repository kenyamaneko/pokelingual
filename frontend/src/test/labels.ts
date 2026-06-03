/**
 * Testing Library 用のラベル正規化ヘルパー。
 *
 * Why: @testing-library/dom の getByText は要素側のテキストにのみデフォルト normalizer
 * (trim + \s+ → ' ') を適用し、クエリ文字列はそのまま比較する非対称な仕様。
 * Pokelingual のラベルは可読性のため U+3000 (全角スペース) を含むため、テスト側で
 * 同じ正規化を適用しないと exact match が失敗する。
 */
export function spec(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}
