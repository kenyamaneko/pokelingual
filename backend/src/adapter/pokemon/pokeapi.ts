import type { PokemonClient, PokemonConfig } from "../../domain/ports.js";
import type { Pokemon } from "../../domain/pokemon.js";
import type { FlavorTextPair } from "../../../../shared/api-types/collection.js";

const versionOrder = [
  "x", "y", "omega-ruby", "alpha-sapphire",
  "sun", "moon", "ultra-sun", "ultra-moon",
  "lets-go-pikachu", "lets-go-eevee",
  "sword", "shield",
];

const versionDisplayNames: Record<string, string> = {
  "x": "X",
  "y": "Y",
  "omega-ruby": "Ωルビー",
  "alpha-sapphire": "αサファイア",
  "sun": "サン",
  "moon": "ムーン",
  "ultra-sun": "Uサン",
  "ultra-moon": "Uムーン",
  "lets-go-pikachu": "ピカブイ",
  "lets-go-eevee": "ピカブイ",
  "sword": "ソード",
  "shield": "シールド",
};

interface PokeAPISpeciesResponse {
  id: number;
  is_legendary: boolean;
  is_mythical: boolean;
  names: { name: string; language: { name: string } }[];
  flavor_text_entries: {
    flavor_text: string;
    language: { name: string };
    version: { name: string };
  }[];
}

interface PokeAPIPokemonResponse {
  sprites: {
    front_default: string;
    other: { "official-artwork": { front_default: string } };
  };
  stats: { base_stat: number }[];
  types: { type: { name: string } }[];
  height: number;
  weight: number;
}

/** PokeAPI から種別情報を取得しメモリキャッシュする PokemonClient 実装。 */
export class PokeAPIClient implements PokemonClient {
  private cache = new Map<number, Pokemon>();

  constructor(private config: PokemonConfig) {}

  async getRandomPokemon(): Promise<Pokemon> {
    const id = Math.floor(Math.random() * this.config.maxPokemonID) + 1;
    return this.getPokemonByID(id);
  }

  async getPokemonByID(id: number): Promise<Pokemon> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const pokemon = await this.fetchFromAPI(id);
    this.cache.set(id, pokemon);
    return pokemon;
  }

  private async fetchFromAPI(id: number): Promise<Pokemon> {
    const [speciesResp, pokemonResp] = await Promise.all([
      fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
      fetch(`https://pokeapi.co/api/v2/pokemon/${id}`),
    ]);

    if (!speciesResp.ok) throw new Error(`species API returned status ${speciesResp.status}`);
    if (!pokemonResp.ok) throw new Error(`pokemon API returned status ${pokemonResp.status}`);

    const species: PokeAPISpeciesResponse = await speciesResp.json();
    const pokemonData: PokeAPIPokemonResponse = await pokemonResp.json();

    let nameEN = "";
    let nameJA = "";
    for (const n of species.names) {
      if (n.language.name === "en") nameEN = n.name;
      if (n.language.name === "ja") nameJA = n.name;
    }

    const flavorTexts = buildFlavorTextPairs(species.flavor_text_entries);
    if (flavorTexts.length === 0) {
      throw new Error(`no EN/JA description pair found for pokemon ${id}`);
    }

    const bst = pokemonData.stats.reduce((sum, s) => sum + s.base_stat, 0);
    const types = pokemonData.types.map((t) => t.type.name);
    const spriteURL =
      pokemonData.sprites.other["official-artwork"].front_default ||
      pokemonData.sprites.front_default;

    return {
      id,
      name_en: nameEN,
      name_ja: nameJA,
      description_en: flavorTexts[0].description_en,
      description_ja: flavorTexts[0].description_ja,
      sprite_url: spriteURL,
      base_stat_total: bst,
      types,
      height: pokemonData.height,
      weight: pokemonData.weight,
      is_legendary: species.is_legendary,
      is_mythical: species.is_mythical,
      flavor_texts: flavorTexts,
    };
  }
}

interface FlavorTextsByVersion {
  en: string;
  ja: string;
  jaHrkt: string;
}

function buildFlavorTextPairs(
  entries: PokeAPISpeciesResponse["flavor_text_entries"],
): FlavorTextPair[] {
  const byVersion = new Map<string, FlavorTextsByVersion>();

  for (const entry of entries) {
    const ver = entry.version.name;
    if (!(ver in versionDisplayNames)) continue;

    if (!byVersion.has(ver)) {
      byVersion.set(ver, { en: "", ja: "", jaHrkt: "" });
    }
    const texts = byVersion.get(ver)!;
    const cleaned = cleanFlavorText(entry.flavor_text);

    switch (entry.language.name) {
      case "en": texts.en = cleaned; break;
      case "ja": texts.ja = cleaned; break;
      case "ja-Hrkt": texts.jaHrkt = cleaned; break;
    }
  }

  interface VersionPair { version: string; en: string; ja: string }
  const pairs: VersionPair[] = [];

  for (const [ver, texts] of byVersion) {
    const ja = texts.ja || texts.jaHrkt;
    if (!texts.en || !ja) continue;
    pairs.push({ version: ver, en: texts.en, ja });
  }

  const orderIndex = new Map(versionOrder.map((v, i) => [v, i]));
  pairs.sort((a, b) => {
    // versionDisplayNames を通過した version は versionOrder にも必ず含まれる契約。
    const aIdx = orderIndex.get(a.version);
    const bIdx = orderIndex.get(b.version);
    if (aIdx === undefined || bIdx === undefined) {
      throw new Error(`version not registered in versionOrder: ${a.version} or ${b.version}`);
    }
    return aIdx - bIdx;
  });

  const result: FlavorTextPair[] = [];
  for (const p of pairs) {
    const displayName = versionDisplayNames[p.version];
    const existing = result.find(
      (r) => r.description_en === p.en && r.description_ja === p.ja,
    );
    if (existing) {
      if (!existing.version_names.includes(displayName)) {
        existing.version_names.push(displayName);
      }
    } else {
      result.push({
        version_names: [displayName],
        description_en: p.en,
        description_ja: p.ja,
      });
    }
  }

  return result;
}

function cleanFlavorText(text: string): string {
  return text
    .replace(/\f/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}
