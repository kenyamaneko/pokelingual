import api from "./client";
import type {
  CollectionResponse,
  PokemonDetailResponse,
} from "../../../shared/api-types/collection";

/** 図鑑コレクション関連エンドポイントを呼ぶ API クライアント。 */
export const collectionApi = {
  getCollection: () => api.get<CollectionResponse>("/collection"),
  getPokemonDetail: (id: number) =>
    api.get<PokemonDetailResponse>(`/collection/${id}`),
};
