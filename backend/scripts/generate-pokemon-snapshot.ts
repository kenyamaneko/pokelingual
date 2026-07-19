import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  convertToPokemonRecord,
  type PokeAPISpeciesData,
  type PokeAPIPokemonData,
} from "./lib/convert.js";
import {
  resolveLevelUpMoveCandidates,
  resolveMoveNameJA,
  resolveLevelUpMoveNames,
  type MoveCandidate,
  type PokeAPIMoveName,
} from "./lib/moves.js";
import { HINT_MOVE_COUNT } from "../src/domain/quest.js";
import type { PokemonRecord } from "../src/domain/pokemon.js";

/**
 * PokeAPI/api-data のローカルクローンから、指定図鑑番号の species / pokemon JSON を読む。
 * @param apiDataDir api-data リポジトリのルートパス。
 * @param resource `pokemon-species` または `pokemon`。
 * @param id 図鑑番号。
 * @returns パース済みの JSON。
 */
async function readApiData(apiDataDir: string, resource: string, id: number): Promise<unknown> {
  const path = join(apiDataDir, "data", "api", "v2", resource, String(id), "index.json");
  return JSON.parse(await readFile(path, "utf-8"));
}

/**
 * PokeAPI/api-data の静的 JSON からポケモン種別データのスナップショットを生成する。
 * 実行時・生成時ともに pokeapi.co を呼ばない。
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "api-data": { type: "string" },
      out: { type: "string" },
      "max-id": { type: "string" },
    },
  });

  if (!values["api-data"] || !values.out || !values["max-id"]) {
    throw new Error(
      "usage: tsx scripts/generate-pokemon-snapshot.ts --api-data <PokeAPI/api-data path> --out <output.json> --max-id <取得する末尾の図鑑番号>",
    );
  }

  const apiDataDir = values["api-data"];
  const outPath = values.out;
  const maxID = parseInt(values["max-id"], 10);
  if (!Number.isInteger(maxID) || maxID < 1) {
    throw new Error(`invalid --max-id: ${values["max-id"]}`);
  }

  // 1st pass: 種・ポケモンの生データを読み、優先順の version_group からレベルアップ技候補を解決する。
  // 技は多くのポケモンで共有されるため、必要な技 ID を集約してから2nd passで1回ずつ読む。
  const speciesList: PokeAPISpeciesData[] = [];
  const pokemonList: PokeAPIPokemonData[] = [];
  const candidatesList: MoveCandidate[][] = [];
  const neededMoveIds = new Set<number>();

  for (let id = 1; id <= maxID; id++) {
    const species = (await readApiData(apiDataDir, "pokemon-species", id)) as PokeAPISpeciesData;
    const pokemon = (await readApiData(apiDataDir, "pokemon", id)) as PokeAPIPokemonData;

    const candidates = resolveLevelUpMoveCandidates(pokemon.moves);
    if (candidates.length === 0) {
      throw new Error(`no level-up moves resolved for pokemon ${id} in any known version group`);
    }
    if (candidates.length < HINT_MOVE_COUNT) {
      console.warn(`pokemon ${id} has only ${candidates.length} level-up move(s) available for hints`);
    }
    for (const c of candidates) neededMoveIds.add(c.id);

    speciesList.push(species);
    pokemonList.push(pokemon);
    candidatesList.push(candidates);
  }

  const moveNamesJA = new Map<string, string>();
  for (const moveId of neededMoveIds) {
    const move = (await readApiData(apiDataDir, "move", moveId)) as { name: string; names: PokeAPIMoveName[] };
    moveNamesJA.set(move.name, resolveMoveNameJA(move.names));
  }

  const records: PokemonRecord[] = [];
  for (let i = 0; i < speciesList.length; i++) {
    const levelUpMoves = resolveLevelUpMoveNames(candidatesList[i], moveNamesJA);
    records.push(convertToPokemonRecord(speciesList[i], pokemonList[i], levelUpMoves));
  }

  await writeFile(outPath, JSON.stringify(records));
  console.log(`wrote ${records.length} pokemon to ${outPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
