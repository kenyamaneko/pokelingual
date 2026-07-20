import api from "./client";
import type {
  PokedexResponse,
  PokedexSearchCandidatesResponse,
  PokemonDetailResponse,
} from "../../../shared/api-types/pokedex";

/** 図鑑コレクション関連エンドポイントを呼ぶ API クライアント。 */
export const pokedexApi = {
  /**
   * GET /pokedex — 図鑑一覧を取得する。
   * @returns 図鑑一覧レスポンス。
   */
  getPokedex: () => api.get<PokedexResponse>("/pokedex"),
  /**
   * GET /pokedex/:id — 特定ポケモンの詳細を取得する。
   * @param id ポケモン ID。
   * @returns ポケモン詳細レスポンス。
   */
  getPokemonDetail: (id: number) =>
    api.get<PokemonDetailResponse>(`/pokedex/${id}`),
  /**
   * GET /pokedex/search-candidates — 苦手ポケモン名前検索の候補母集団を取得する。
   * @returns 検索候補一覧レスポンス。
   */
  getSearchCandidates: () =>
    api.get<PokedexSearchCandidatesResponse>("/pokedex/search-candidates"),
};
