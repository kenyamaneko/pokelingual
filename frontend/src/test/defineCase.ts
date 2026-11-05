import { it } from "vitest";

/** テストの種別。 */
export type CaseKind =
  | "単体テスト"
  | "部品間結合テスト"
  | "インフラ結合テスト"
  | "サービス間結合テスト"
  | "E2Eテスト"
  | "シナリオテスト"
  | "スモークテスト";

/** ケースが正常系か異常系か。 */
export type CaseOutcome = "正常系" | "異常系";

/** ケースの 1 ステップ。Given は前提が無いときや、直前のステップの続きのときに省略する。 */
export type SpecStep = {
  Given?: string;
  When: readonly [string, ...string[]];
  Then: string;
};

/** ケースの項目。ステップは 1 つ以上。複数にするのは、シナリオテストと、異常からの回復の確認だけ。 */
export type SpecFields = {
  種別: CaseKind;
  正常異常: CaseOutcome;
  steps: readonly [SpecStep, ...SpecStep[]];
};

const STEP_SEPARATOR = "→";
const CLAUSE_SEPARATOR = "、";
const LAST_OPERATION_SUFFIX = "と";

// テスト観点カタログの生成が、この名前の注釈を読む。backend は rootDir が src のため shared の実行コードを取り込めず、backend と frontend に同じ内容を置く。
const ANNOTATION = { kind: "種別", outcome: "正常異常", given: "Given", when: "When", then: "Then" } as const;

function composeStepName(step: SpecStep): string {
  const operations = step.When.map((operation, index) =>
    index === step.When.length - 1 ? `${operation}${LAST_OPERATION_SUFFIX}` : operation,
  );
  return [step.Given, ...operations, step.Then].filter(Boolean).join(CLAUSE_SEPARATOR);
}

/**
 * ケースを 1 件登録する。テスト名はステップから組み立て、項目を注釈としてテスト結果に載せる。
 * @param fields 種別・正常異常・ステップ。
 * @param body 検証の本体。複数ステップのときは、ステップごとの確認をこの中で順に行う。
 */
export function defineCase(fields: SpecFields, body: () => void | Promise<void>): void {
  it(fields.steps.map(composeStepName).join(STEP_SEPARATOR), async ({ annotate }) => {
    await annotate(fields.種別, ANNOTATION.kind);
    await annotate(fields.正常異常, ANNOTATION.outcome);
    for (const step of fields.steps) {
      if (step.Given) await annotate(step.Given, ANNOTATION.given);
      for (const operation of step.When) await annotate(operation, ANNOTATION.when);
      await annotate(step.Then, ANNOTATION.then);
    }
    await body();
  });
}
