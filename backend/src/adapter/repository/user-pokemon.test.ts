import { describe, expect, beforeEach } from "vitest";
import { UserPokemonRepo } from "./user-pokemon-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";
import { defineCase } from "../../test/defineCase.js";

const db = requireFirestoreEmulator();

const POKEMON_ID = 25;

type EncounterRecord = { score: number; isCaptured: boolean };
type History = {
  given: string;
  records: readonly EncounterRecord[];
  operation: string;
};

const NOT_ENCOUNTERED = "あるユーザーがまだ遭遇していないポケモンがいるとき";
const ENCOUNTERED_NOT_CAPTURED = "あるユーザーが遭遇済みで、まだ捕獲していないポケモンがいるとき";
const CAPTURED = "あるユーザーが捕獲済みのポケモンがいるとき";
const RECORD_ENCOUNTER_WITHOUT_CAPTURE = "そのポケモンの遭遇を、捕獲せずに記録する";

const SEEN_FIRST_TIME: History = {
  given: NOT_ENCOUNTERED,
  records: [{ score: 70, isCaptured: false }],
  operation: RECORD_ENCOUNTER_WITHOUT_CAPTURE,
};
const CAPTURED_FIRST_TIME: History = {
  given: NOT_ENCOUNTERED,
  records: [{ score: 90, isCaptured: true }],
  operation: "そのポケモンの遭遇を、捕獲して記録する",
};
const SEEN_AGAIN_WITHOUT_CAPTURE: History = {
  given: ENCOUNTERED_NOT_CAPTURED,
  records: [
    { score: 70, isCaptured: false },
    { score: 60, isCaptured: false },
  ],
  operation: "そのポケモンの遭遇を、捕獲せずに記録する",
};
const CAPTURED_AFTER_SEEN: History = {
  given: ENCOUNTERED_NOT_CAPTURED,
  records: [
    { score: 70, isCaptured: false },
    { score: 95, isCaptured: true },
  ],
  operation: "そのポケモンの遭遇を、捕獲して記録する",
};
const SEEN_AGAIN_AFTER_CAPTURE: History = {
  given: CAPTURED,
  records: [
    { score: 95, isCaptured: true },
    { score: 50, isCaptured: false },
  ],
  operation: "そのポケモンの遭遇を、捕獲せずに記録する",
};

async function recordAndMeasureLastRecord(records: readonly EncounterRecord[]) {
  const repo = new UserPokemonRepo(db);
  const preceding = records.slice(0, -1);
  const last = records[records.length - 1];
  for (const { score, isCaptured } of preceding) {
    await repo.upsertEncounter("alice", POKEMON_ID, score, isCaptured);
  }
  const startedAt = new Date();
  await repo.upsertEncounter("alice", POKEMON_ID, last.score, last.isCaptured);
  const finishedAt = new Date();
  const pokemon = await repo.getPokemon("alice", POKEMON_ID);
  return { pokemon, startedAt, finishedAt };
}

async function recordAndGetPokemon(records: readonly EncounterRecord[]) {
  return (await recordAndMeasureLastRecord(records)).pokemon;
}

const GET_POKEMON_DETAIL = "そのポケモンの図鑑詳細を取得する";
const GET_POKEDEX = "あるユーザーの図鑑一覧を取得する";

describe("[本体:図鑑]遭遇・捕獲の記録", () => {
  beforeEach(clearFirestoreEmulator);

  for (const { given, operation, records } of [SEEN_FIRST_TIME, SEEN_AGAIN_WITHOUT_CAPTURE]) {
    defineCase(
      {
        種別: "インフラ結合テスト",
        正常異常: "正常系",
        steps: [
          {
            Given: given,
            When: [operation, GET_POKEMON_DETAIL],
            Then: "図鑑の状態は遭遇済みになる",
          },
        ],
      },
      async () => {
        expect((await recordAndGetPokemon(records)).status).toBe("seen");
      },
    );
  }

  for (const { given, operation, records } of [CAPTURED_FIRST_TIME, CAPTURED_AFTER_SEEN, SEEN_AGAIN_AFTER_CAPTURE]) {
    defineCase(
      {
        種別: "インフラ結合テスト",
        正常異常: "正常系",
        steps: [
          {
            Given: given,
            When: [operation, GET_POKEMON_DETAIL],
            Then: "図鑑の状態は捕獲済みになる",
          },
        ],
      },
      async () => {
        expect((await recordAndGetPokemon(records)).status).toBe("captured");
      },
    );
  }

  for (const { given, operation, records } of [SEEN_FIRST_TIME, CAPTURED_FIRST_TIME]) {
    defineCase(
      {
        種別: "インフラ結合テスト",
        正常異常: "正常系",
        steps: [
          {
            Given: given,
            When: [operation, GET_POKEMON_DETAIL],
            Then: "遭遇回数は 1 になる",
          },
        ],
      },
      async () => {
        expect((await recordAndGetPokemon(records)).total_encounters).toBe(1);
      },
    );
  }

  for (const { given, operation, records } of [SEEN_AGAIN_WITHOUT_CAPTURE, CAPTURED_AFTER_SEEN, SEEN_AGAIN_AFTER_CAPTURE]) {
    defineCase(
      {
        種別: "インフラ結合テスト",
        正常異常: "正常系",
        steps: [
          {
            Given: given,
            When: [operation, GET_POKEMON_DETAIL],
            Then: "遭遇回数は 2 になる",
          },
        ],
      },
      async () => {
        expect((await recordAndGetPokemon(records)).total_encounters).toBe(2);
      },
    );
  }

  for (const { given, operation, records } of [SEEN_FIRST_TIME, SEEN_AGAIN_WITHOUT_CAPTURE]) {
    defineCase(
      {
        種別: "インフラ結合テスト",
        正常異常: "正常系",
        steps: [
          {
            Given: given,
            When: [operation, GET_POKEMON_DETAIL],
            Then: "捕獲回数は 0 になる",
          },
        ],
      },
      async () => {
        expect((await recordAndGetPokemon(records)).total_captures).toBe(0);
      },
    );
  }

  for (const { given, operation, records } of [CAPTURED_FIRST_TIME, CAPTURED_AFTER_SEEN, SEEN_AGAIN_AFTER_CAPTURE]) {
    defineCase(
      {
        種別: "インフラ結合テスト",
        正常異常: "正常系",
        steps: [
          {
            Given: given,
            When: [operation, GET_POKEMON_DETAIL],
            Then: "捕獲回数は 1 になる",
          },
        ],
      },
      async () => {
        expect((await recordAndGetPokemon(records)).total_captures).toBe(1);
      },
    );
  }

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: NOT_ENCOUNTERED,
          When: ["そのポケモンの遭遇を、スコア 70 で捕獲せずに記録する", GET_POKEMON_DETAIL],
          Then: "最高スコアは 70 になる",
        },
      ],
    },
    async () => {
      const pokemon = await recordAndGetPokemon([{ score: 70, isCaptured: false }]);
      expect(pokemon.best_score).toBe(70);
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: NOT_ENCOUNTERED,
          When: ["そのポケモンの遭遇を、スコア 90 で捕獲して記録する", GET_POKEMON_DETAIL],
          Then: "最高スコアは 90 になる",
        },
      ],
    },
    async () => {
      const pokemon = await recordAndGetPokemon([{ score: 90, isCaptured: true }]);
      expect(pokemon.best_score).toBe(90);
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: NOT_ENCOUNTERED,
          When: ["そのポケモンの遭遇を、スコア 80、60、90、70 の順に記録する", GET_POKEMON_DETAIL],
          Then: "最高スコアは 90 になる",
        },
      ],
    },
    async () => {
      const pokemon = await recordAndGetPokemon([
        { score: 80, isCaptured: false },
        { score: 60, isCaptured: false },
        { score: 90, isCaptured: true },
        { score: 70, isCaptured: false },
      ]);
      expect(pokemon.best_score).toBe(90);
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: NOT_ENCOUNTERED,
          When: [RECORD_ENCOUNTER_WITHOUT_CAPTURE, GET_POKEMON_DETAIL],
          Then: "最終捕獲日時は空になる",
        },
      ],
    },
    async () => {
      const pokemon = await recordAndGetPokemon(SEEN_FIRST_TIME.records);
      expect(pokemon.last_captured_at).toBeNull();
    },
  );

  for (const { given, operation, records } of [CAPTURED_FIRST_TIME, CAPTURED_AFTER_SEEN]) {
    defineCase(
      {
        種別: "インフラ結合テスト",
        正常異常: "正常系",
        steps: [
          {
            Given: given,
            When: [operation, GET_POKEMON_DETAIL],
            Then: "最終捕獲日時は捕獲を記録した日時になる",
          },
        ],
      },
      async () => {
        const { pokemon, startedAt, finishedAt } = await recordAndMeasureLastRecord(records);
        expect(pokemon.last_captured_at?.getTime()).toBeGreaterThanOrEqual(startedAt.getTime());
        expect(pokemon.last_captured_at?.getTime()).toBeLessThanOrEqual(finishedAt.getTime());
      },
    );
  }

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: NOT_ENCOUNTERED,
          When: [RECORD_ENCOUNTER_WITHOUT_CAPTURE, GET_POKEMON_DETAIL],
          Then: "最終遭遇日時は遭遇を記録した日時になる",
        },
      ],
    },
    async () => {
      const { pokemon, startedAt, finishedAt } = await recordAndMeasureLastRecord(SEEN_FIRST_TIME.records);
      expect(pokemon.last_encountered_at.getTime()).toBeGreaterThanOrEqual(startedAt.getTime());
      expect(pokemon.last_encountered_at.getTime()).toBeLessThanOrEqual(finishedAt.getTime());
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "あるユーザーがまだ遭遇していない、図鑑番号 25 のポケモンがいるとき",
          When: [RECORD_ENCOUNTER_WITHOUT_CAPTURE, GET_POKEMON_DETAIL],
          Then: "記録の図鑑番号は 25 になる",
        },
      ],
    },
    async () => {
      const pokemon = await recordAndGetPokemon(SEEN_FIRST_TIME.records);
      expect(pokemon.pokemon_id).toBe(25);
    },
  );
});

describe("[本体:図鑑]図鑑一覧の取得", () => {
  beforeEach(clearFirestoreEmulator);

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: ["あるユーザーの遭遇を、図鑑番号 150、1、25 の順に記録する", GET_POKEDEX],
          Then: "図鑑一覧の図鑑番号は 1、25、150 の昇順になる",
        },
      ],
    },
    async () => {
      const repo = new UserPokemonRepo(db);
      await repo.upsertEncounter("alice", 150, 80, true);
      await repo.upsertEncounter("alice", 1, 70, false);
      await repo.upsertEncounter("alice", 25, 90, true);

      const pokedex = await repo.getPokedex("alice");
      expect(pokedex.map((p) => p.pokemon_id)).toEqual([1, 25, 150]);
    },
  );

  for (const { situation, otherUserRecords } of [
    { situation: "どのユーザーもまだ何も記録していない", otherUserRecords: [] },
    {
      situation: "別のユーザーだけがポケモンを記録している",
      otherUserRecords: [{ score: 90, isCaptured: true }],
    },
  ]) {
    defineCase(
      {
        種別: "インフラ結合テスト",
        正常異常: "正常系",
        観点: ["件数・有無"],
        steps: [
          {
            Given: `${situation}とき`,
            When: [GET_POKEDEX],
            Then: "図鑑一覧は空になる",
          },
        ],
      },
      async () => {
        const repo = new UserPokemonRepo(db);
        for (const { score, isCaptured } of otherUserRecords) {
          await repo.upsertEncounter("bob", POKEMON_ID, score, isCaptured);
        }

        expect(await repo.getPokedex("alice")).toEqual([]);
      },
    );
  }
});

describe("[本体:図鑑]図鑑詳細の取得", () => {
  beforeEach(clearFirestoreEmulator);

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "異常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: NOT_ENCOUNTERED,
          When: [GET_POKEMON_DETAIL],
          Then: "そのポケモンの記録が無いことを示すエラーになる",
        },
      ],
    },
    async () => {
      const repo = new UserPokemonRepo(db);
      await expect(repo.getPokemon("alice", 25)).rejects.toThrow(/pokemon not found/);
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "異常系",
      観点: ["回復確認", "件数・有無"],
      steps: [
        {
          Given: NOT_ENCOUNTERED,
          When: [GET_POKEMON_DETAIL],
          Then: "そのポケモンの記録が無いことを示すエラーになる",
        },
        {
          When: [RECORD_ENCOUNTER_WITHOUT_CAPTURE, GET_POKEMON_DETAIL],
          Then: "図鑑の状態は遭遇済みになる",
        },
      ],
    },
    async () => {
      const repo = new UserPokemonRepo(db);
      await expect(repo.getPokemon("alice", 25)).rejects.toThrow(/pokemon not found/);

      await repo.upsertEncounter("alice", 25, 70, false);

      expect((await repo.getPokemon("alice", 25)).status).toBe("seen");
    },
  );
});
