import type { PokemonClient } from "../../domain/ports.js";
import type { Pokemon, PokemonRecord } from "../../domain/pokemon.js";
import type { PokemonType } from "../../../../shared/api-types/pokemon.js";
import { buildSpriteURL } from "./sprite-url.js";

/** スナップショット JSON テキストを供給するトランスポート。GCS/ローカルの差し替え境界。 */
export type SnapshotReader = () => Promise<string>;

/**
 * スナップショットを読み込みポケモンレコード配列にパースする。
 * @param read スナップショット JSON テキストを返す reader。
 * @returns ポケモンレコードの配列。
 * @throws JSON が配列でない場合。
 */
export async function loadPokemonSnapshot(read: SnapshotReader): Promise<PokemonRecord[]> {
  const parsed = JSON.parse(await read()) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("pokemon snapshot must be a JSON array");
  }
  return parsed as PokemonRecord[];
}

/** スナップショットからポケモンの種別情報を供給する PokemonClient 実装。全件をメモリに載せる (ADR-022)。 */
export class SnapshotPokemonClient implements PokemonClient {
  private readonly byID = new Map<number, PokemonRecord>();
  private readonly idsByType = new Map<PokemonType, number[]>();
  private readonly servableIDs: readonly number[];

  /**
   * 図鑑番号をキーとする索引と、タイプ別の図鑑番号の逆引き索引を構築する。
   * @param records スナップショットの全ポケモン (図鑑番号は一意)。
   */
  constructor(records: readonly PokemonRecord[]) {
    for (const record of records) {
      this.byID.set(record.id, record);
      for (const type of record.types) {
        const ids = this.idsByType.get(type) ?? [];
        ids.push(record.id);
        this.idsByType.set(type, ids);
      }
    }
    this.servableIDs = [...this.byID.keys()].sort((a, b) => a - b);
  }

  /**
   * スナップショットに含まれる図鑑番号を昇順で返す。
   * @returns 図鑑番号の配列。
   */
  getServableIDs(): readonly number[] {
    return this.servableIDs;
  }

  /**
   * 指定タイプを持つポケモンの図鑑番号を返す。
   * @param type ポケモンのタイプ。
   * @returns 該当する図鑑番号の配列。
   */
  async getIDsByType(type: PokemonType): Promise<readonly number[]> {
    return this.idsByType.get(type) ?? [];
  }

  /**
   * 図鑑番号でポケモンを取得する。sprite_url は図鑑番号から組み立てて付与する。
   * @param id 図鑑番号。
   * @returns 該当ポケモン。
   * @throws スナップショットに存在しない場合。
   */
  async getPokemonByID(id: number): Promise<Pokemon> {
    const record = this.byID.get(id);
    if (!record) throw new Error(`pokemon not found in snapshot: ${id}`);
    return { ...record, sprite_url: buildSpriteURL(id) };
  }
}
