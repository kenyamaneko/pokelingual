import { describe, it, expect, beforeEach } from "vitest";
import { UserPokemonRepo } from "./user-pokemon-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";

const db = requireFirestoreEmulator();

const POKEMON_ID = 25;

type EncounterRecord = { score: number; isCaptured: boolean };
type History = readonly [label: string, records: readonly EncounterRecord[]];

const SEEN_FIRST_TIME: History = [
  "初めて遭遇したポケモンを、捕獲せずに記録した",
  [{ score: 70, isCaptured: false }],
];
const CAPTURED_FIRST_TIME: History = [
  "初めて遭遇したポケモンを、捕獲して記録した",
  [{ score: 90, isCaptured: true }],
];
const SEEN_AGAIN_WITHOUT_CAPTURE: History = [
  "遭遇済みのポケモンへの再度の遭遇を、捕獲せずに記録した",
  [
    { score: 70, isCaptured: false },
    { score: 60, isCaptured: false },
  ],
];
const CAPTURED_AFTER_SEEN: History = [
  "遭遇済みのポケモンの捕獲を記録した",
  [
    { score: 70, isCaptured: false },
    { score: 95, isCaptured: true },
  ],
];
const SEEN_AGAIN_AFTER_CAPTURE: History = [
  "捕獲済みのポケモンへの再度の遭遇を、捕獲せずに記録した",
  [
    { score: 95, isCaptured: true },
    { score: 50, isCaptured: false },
  ],
];

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

describe("[図鑑] 遭遇・捕獲の記録", () => {
  beforeEach(clearFirestoreEmulator);

  describe("遭遇・捕獲を記録したポケモンの記録を取得する", () => {
    describe("正常系", () => {
      it.each([SEEN_FIRST_TIME, SEEN_AGAIN_WITHOUT_CAPTURE])(
        "%sとき、図鑑の状態は遭遇済みになる",
        async (_label, records) => {
          expect((await recordAndGetPokemon(records)).status).toBe("seen");
        },
      );

      it.each([CAPTURED_FIRST_TIME, CAPTURED_AFTER_SEEN, SEEN_AGAIN_AFTER_CAPTURE])(
        "%sとき、図鑑の状態は捕獲済みになる",
        async (_label, records) => {
          expect((await recordAndGetPokemon(records)).status).toBe("captured");
        },
      );

      it.each([SEEN_FIRST_TIME, CAPTURED_FIRST_TIME])(
        "%sとき、遭遇回数は 1 になる",
        async (_label, records) => {
          expect((await recordAndGetPokemon(records)).total_encounters).toBe(1);
        },
      );

      it.each([SEEN_AGAIN_WITHOUT_CAPTURE, CAPTURED_AFTER_SEEN, SEEN_AGAIN_AFTER_CAPTURE])(
        "%sとき、遭遇回数は 2 になる",
        async (_label, records) => {
          expect((await recordAndGetPokemon(records)).total_encounters).toBe(2);
        },
      );

      it.each([SEEN_FIRST_TIME, SEEN_AGAIN_WITHOUT_CAPTURE])(
        "%sとき、捕獲回数は 0 になる",
        async (_label, records) => {
          expect((await recordAndGetPokemon(records)).total_captures).toBe(0);
        },
      );

      it.each([CAPTURED_FIRST_TIME, CAPTURED_AFTER_SEEN, SEEN_AGAIN_AFTER_CAPTURE])(
        "%sとき、捕獲回数は 1 になる",
        async (_label, records) => {
          expect((await recordAndGetPokemon(records)).total_captures).toBe(1);
        },
      );

      it("初めて遭遇したポケモンを、スコア 70 で捕獲せずに記録したとき、最高スコアは 70 になる", async () => {
        const pokemon = await recordAndGetPokemon([{ score: 70, isCaptured: false }]);
        expect(pokemon.best_score).toBe(70);
      });

      it("初めて遭遇したポケモンを、スコア 90 で捕獲して記録したとき、最高スコアは 90 になる", async () => {
        const pokemon = await recordAndGetPokemon([{ score: 90, isCaptured: true }]);
        expect(pokemon.best_score).toBe(90);
      });

      it("スコア 80、60、90、70 の順に同じポケモンの遭遇を記録したとき、最高スコアは 90 になる", async () => {
        const pokemon = await recordAndGetPokemon([
          { score: 80, isCaptured: false },
          { score: 60, isCaptured: false },
          { score: 90, isCaptured: true },
          { score: 70, isCaptured: false },
        ]);
        expect(pokemon.best_score).toBe(90);
      });

      it("初めて遭遇したポケモンを、捕獲せずに記録したとき、最終捕獲日時は空になる", async () => {
        const pokemon = await recordAndGetPokemon(SEEN_FIRST_TIME[1]);
        expect(pokemon.last_captured_at).toBeNull();
      });

      it.each([CAPTURED_FIRST_TIME, CAPTURED_AFTER_SEEN])(
        "%sとき、最終捕獲日時は捕獲を記録した日時になる",
        async (_label, records) => {
          const { pokemon, startedAt, finishedAt } = await recordAndMeasureLastRecord(records);
          expect(pokemon.last_captured_at?.getTime()).toBeGreaterThanOrEqual(startedAt.getTime());
          expect(pokemon.last_captured_at?.getTime()).toBeLessThanOrEqual(finishedAt.getTime());
        },
      );

      it("初めて遭遇したポケモンを、捕獲せずに記録したとき、最終遭遇日時は遭遇を記録した日時になる", async () => {
        const { pokemon, startedAt, finishedAt } = await recordAndMeasureLastRecord(SEEN_FIRST_TIME[1]);
        expect(pokemon.last_encountered_at.getTime()).toBeGreaterThanOrEqual(startedAt.getTime());
        expect(pokemon.last_encountered_at.getTime()).toBeLessThanOrEqual(finishedAt.getTime());
      });

      it("図鑑番号 25 のポケモンを初めて遭遇して記録したとき、図鑑番号は 25 になる", async () => {
        const pokemon = await recordAndGetPokemon(SEEN_FIRST_TIME[1]);
        expect(pokemon.pokemon_id).toBe(25);
      });
    });
  });
});

describe("[図鑑] 図鑑の取得", () => {
  beforeEach(clearFirestoreEmulator);

  describe("図鑑を取得する", () => {
    describe("正常系", () => {
      it("図鑑番号 150、1、25 の順にポケモンを記録したとき、図鑑番号 1、25、150 の昇順で得られる", async () => {
        const repo = new UserPokemonRepo(db);
        await repo.upsertEncounter("alice", 150, 80, true);
        await repo.upsertEncounter("alice", 1, 70, false);
        await repo.upsertEncounter("alice", 25, 90, true);

        const pokedex = await repo.getPokedex("alice");
        expect(pokedex.map((p) => p.pokemon_id)).toEqual([1, 25, 150]);
      });

      it.each([
        ["どのユーザーもまだ何も記録していない", []],
        ["別のユーザーだけがポケモンを記録している", [{ score: 90, isCaptured: true }]],
      ])("%sとき、図鑑は空になる", async (_label, otherUserRecords) => {
        const repo = new UserPokemonRepo(db);
        for (const { score, isCaptured } of otherUserRecords) {
          await repo.upsertEncounter("bob", POKEMON_ID, score, isCaptured);
        }

        expect(await repo.getPokedex("alice")).toEqual([]);
      });
    });
  });

  describe("異常系", () => {
    it("遭遇していないポケモンの記録を取得すると、そのポケモンの記録が無いことを示すエラーになる", async () => {
      const repo = new UserPokemonRepo(db);
      await expect(repo.getPokemon("alice", 25)).rejects.toThrow(/pokemon not found/);
    });
  });
});
