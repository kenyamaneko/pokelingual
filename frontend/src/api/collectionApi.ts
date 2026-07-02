import api from "./client";
import type {
  CollectionResponse,
  PokemonDetailResponse,
} from "../../../shared/api-types/collection";

/** 図鑑コレクション関連エンドポイントを呼ぶ API クライアント。 */
export const collectionApi = {
  /**
   * GET /collection — 図鑑一覧を取得する。
   * @returns 図鑑一覧レスポンス。
   */
  getCollection: () => api.get<CollectionResponse>("/collection"),
  /**
   * GET /collection/:id — 特定ポケモンの詳細を取得する。
   * @param id ポケモン ID。
   * @returns ポケモン詳細レスポンス。
   */
  getPokemonDetail: (id: number) =>
    api.get<PokemonDetailResponse>(`/collection/${id}`),
};
