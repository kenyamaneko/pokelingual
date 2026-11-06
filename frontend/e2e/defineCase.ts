import {
  test,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
  type PlaywrightWorkerArgs,
  type PlaywrightWorkerOptions,
  type TestInfo,
} from "@playwright/test";

/** シナリオテストが実行される環境。 */
export type Environment = "ローカル" | "dev環境";

/** 環境ごとの結果。 */
export type ThenByEnvironment = Readonly<Record<Environment, string>>;

/** シナリオテスト以外の種別。 */
export type NonScenarioKind = "部品間結合テスト" | "E2Eテスト";

/** ケースが正常系か異常系か。 */
export type CaseOutcome = "正常系" | "異常系";

/** ケースの 1 ステップ。Given は前提が無いときや、直前のステップの続きのときに省略する。 */
export type SpecStep = {
  Given?: string;
  When: readonly [string, ...string[]];
  Then: string;
};

/** シナリオテストの 1 ステップ。環境によって結果が違うときだけ、Then を環境ごとの結果で書く。 */
export type ScenarioStep = Omit<SpecStep, "Then"> & {
  Then: string | ThenByEnvironment;
};

/**
 * ケースの項目。ステップは 1 つ以上。複数にするのは、シナリオテストと、異常からの回復の確認だけ。
 * 環境は、シナリオテストだけが持つ。
 */
export type SpecFields =
  | {
      種別: NonScenarioKind;
      正常異常: CaseOutcome;
      観点?: readonly Viewpoint[];
      steps: readonly [SpecStep, ...SpecStep[]];
    }
  | {
      種別: "シナリオテスト";
      正常異常: CaseOutcome;
      観点?: readonly Viewpoint[];
      環境: readonly [Environment, ...Environment[]];
      steps: readonly [ScenarioStep, ...ScenarioStep[]];
    };

type SpecBody = (
  args: PlaywrightTestArgs & PlaywrightTestOptions & PlaywrightWorkerArgs & PlaywrightWorkerOptions,
  testInfo: TestInfo,
) => Promise<void> | void;

const STEP_SEPARATOR = "→";
const CLAUSE_SEPARATOR = "、";
const LAST_OPERATION_SUFFIX = "と";
/** ケースに付ける観点。 */
export type Viewpoint =
  | "境界値"
  | "同値分割"
  | "エッジケース"
  | "件数・有無"
  | "外部依存の失敗"
  | "回復確認";

// テストケースカタログの生成が、この名前の注釈を読む。Vitest 側の defineCase と同じ内容を置く (別のテストランナーのため共有できない)。
const ANNOTATION = {
  kind: "種別",
  outcome: "正常異常",
  viewpoint: "観点",
  environment: "環境",
  given: "Given",
  when: "When",
  then: "Then",
  thenOf: (environment: Environment) => `Then:${environment}`,
} as const;

const ENVIRONMENTS: readonly Environment[] = ["ローカル", "dev環境"];

/** いま実行している環境。E2E_MODE が dev のときだけ dev 環境、それ以外はローカル。 */
export const CURRENT_ENVIRONMENT: Environment = process.env.E2E_MODE === "dev" ? "dev環境" : "ローカル";

/**
 * 実行中の環境に対応する値を返す。環境ごとに期待値が違うステップの検証で、分岐の代わりに使う。
 * @param values 環境ごとの値。
 */
export function byEnvironment<T>(values: Readonly<Record<Environment, T>>): T {
  return values[CURRENT_ENVIRONMENT];
}

function composeThen(then: string | ThenByEnvironment): string {
  if (typeof then === "string") return then;
  return ENVIRONMENTS.map((environment) => `${environment}では${then[environment]}`).join(CLAUSE_SEPARATOR);
}

function composeStepName(step: SpecStep | ScenarioStep): string {
  const operations = step.When.map((operation, index) =>
    index === step.When.length - 1 ? `${operation}${LAST_OPERATION_SUFFIX}` : operation,
  );
  return [step.Given, ...operations, composeThen(step.Then)].filter(Boolean).join(CLAUSE_SEPARATOR);
}

function annotateThen(then: string | ThenByEnvironment) {
  if (typeof then === "string") return [{ type: ANNOTATION.then, description: then }];
  return ENVIRONMENTS.map((environment) => ({ type: ANNOTATION.thenOf(environment), description: then[environment] }));
}

/**
 * E2E のケースを 1 件登録する。テスト名はステップから組み立て、項目を注釈としてテスト結果に載せる。
 * シナリオテストは、環境に含まれない環境で実行されたときスキップする。
 * @param fields 種別・正常異常・ステップ。シナリオテストは、実行する環境も持つ。観点は任意。
 * @param body 検証の本体。複数ステップのときは、ステップごとの確認をこの中で順に行う。
 */
export function defineCase(fields: SpecFields, body: SpecBody): void {
  const title = fields.steps.map(composeStepName).join(STEP_SEPARATOR);
  const viewpoints = fields.観点 ?? [];
  const environments = fields.種別 === "シナリオテスト" ? fields.環境 : [];
  const annotation = [
    { type: ANNOTATION.kind, description: fields.種別 },
    { type: ANNOTATION.outcome, description: fields.正常異常 },
    ...viewpoints.map((viewpoint) => ({ type: ANNOTATION.viewpoint, description: viewpoint })),
    ...environments.map((environment) => ({ type: ANNOTATION.environment, description: environment })),
    ...fields.steps.flatMap((step) => [
      ...(step.Given ? [{ type: ANNOTATION.given, description: step.Given }] : []),
      ...step.When.map((operation) => ({ type: ANNOTATION.when, description: operation })),
      ...annotateThen(step.Then),
    ]),
  ];
  const isRunnable = fields.種別 !== "シナリオテスト" || fields.環境.includes(CURRENT_ENVIRONMENT);
  if (isRunnable) {
    test(title, { annotation }, body);
  } else {
    test.skip(title, { annotation }, body);
  }
}
