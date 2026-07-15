import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  convertToPokemonRecord,
  type PokeAPISpeciesData,
  type PokeAPIPokemonData,
} from "./lib/convert.js";
import type { PokemonRecord } from "../src/domain/pokemon.js";

// 対象バージョン (X〜ソード/シールド) の EN/JA 説明文が揃うのが第 8 世代までのため、その全国図鑑上限。
const DEFAULT_MAX_ID = 898;

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
 * 実行時・生成時ともに pokeapi.co を呼ばない (ADR-022)。
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "api-data": { type: "string" },
      out: { type: "string" },
      "max-id": { type: "string", default: String(DEFAULT_MAX_ID) },
    },
  });

  if (!values["api-data"] || !values.out) {
    throw new Error(
      "usage: tsx scripts/generate-pokemon-snapshot.ts --api-data <PokeAPI/api-data path> --out <output.json> [--max-id 898]",
    );
  }

  const apiDataDir = values["api-data"];
  const outPath = values.out;
  const maxID = parseInt(values["max-id"], 10);
  if (!Number.isInteger(maxID) || maxID < 1) {
    throw new Error(`invalid --max-id: ${values["max-id"]}`);
  }

  const records: PokemonRecord[] = [];
  for (let id = 1; id <= maxID; id++) {
    const species = (await readApiData(apiDataDir, "pokemon-species", id)) as PokeAPISpeciesData;
    const pokemon = (await readApiData(apiDataDir, "pokemon", id)) as PokeAPIPokemonData;
    records.push(convertToPokemonRecord(species, pokemon));
  }

  await writeFile(outPath, JSON.stringify(records));
  console.log(`wrote ${records.length} pokemon to ${outPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
