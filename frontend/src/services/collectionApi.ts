import api from "./api";
import type { CollectionEntry, PokemonDetail } from "../types";

export const collectionApi = {
  getCollection: () =>
    api.get<{ pokemon: CollectionEntry[]; total_available: number; captured_count: number }>("/collection"),
  getPokemonDetail: (id: number) =>
    api.get<PokemonDetail>(`/collection/${id}`),
};
