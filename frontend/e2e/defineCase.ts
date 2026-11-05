import {
  test,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
  type PlaywrightWorkerArgs,
  type PlaywrightWorkerOptions,
  type TestInfo,
} from "@playwright/test";

/** テストの種別。 */
export type CaseKind = "部品間結合テスト" | "E2Eテスト" | "シナリオテスト" | "スモークテスト";

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

type SpecBody = (
  args: PlaywrightTestArgs & PlaywrightTestOptions & PlaywrightWorkerArgs & PlaywrightWorkerOptions,
  testInfo: TestInfo,
) => Promise<void> | void;

const STEP_SEPARATOR = "→";
const CLAUSE_SEPARATOR = "、";
const LAST_OPERATION_SUFFIX = "と";

// テスト観点カタログの生成が、この名前の注釈を読む。Vitest 側の defineCase と同じ内容を置く (別のテストランナーのため共有できない)。
const ANNOTATION = { kind: "種別", outcome: "正常異常", given: "Given", when: "When", then: "Then" } as const;

function composeStepName(step: SpecStep): string {
  const operations = step.When.map((operation, index) =>
    index === step.When.length - 1 ? `${operation}${LAST_OPERATION_SUFFIX}` : operation,
  );
  return [step.Given, ...operations, step.Then].filter(Boolean).join(CLAUSE_SEPARATOR);
}

/**
 * E2E のケースを 1 件登録する。テスト名はステップから組み立て、項目を注釈としてテスト結果に載せる。
 * @param fields 種別・正常異常・ステップ。
 * @param body 検証の本体。複数ステップのときは、ステップごとの確認をこの中で順に行う。
 */
export function defineCase(fields: SpecFields, body: SpecBody): void {
  const annotation = [
    { type: ANNOTATION.kind, description: fields.種別 },
    { type: ANNOTATION.outcome, description: fields.正常異常 },
    ...fields.steps.flatMap((step) => [
      ...(step.Given ? [{ type: ANNOTATION.given, description: step.Given }] : []),
      ...step.When.map((operation) => ({ type: ANNOTATION.when, description: operation })),
      { type: ANNOTATION.then, description: step.Then },
    ]),
  ];
  test(fields.steps.map(composeStepName).join(STEP_SEPARATOR), { annotation }, body);
}
