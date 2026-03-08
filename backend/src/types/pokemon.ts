export interface FlavorTextPair {
  version_names: string[];
  description_en: string;
  description_ja: string;
}

export interface Pokemon {
  id: number;
  name_en: string;
  name_ja: string;
  description_en: string;
  description_ja: string;
  sprite_url: string;
  base_stat_total: number;
  types: string[];
  height: number;
  weight: number;
  is_legendary: boolean;
  is_mythical: boolean;
  flavor_texts?: FlavorTextPair[];
}
