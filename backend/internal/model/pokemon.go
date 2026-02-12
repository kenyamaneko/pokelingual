package model

// FlavorTextPair holds a pair of EN/JA descriptions from the same game version(s).
type FlavorTextPair struct {
	VersionNames  []string `json:"version_names"`
	DescriptionEN string   `json:"description_en"`
	DescriptionJA string   `json:"description_ja"`
}

// Pokemon represents a Pokemon's core data fetched from PokeAPI.
type Pokemon struct {
	ID            int              `json:"id"`
	NameEN        string           `json:"name_en"`
	NameJA        string           `json:"name_ja"`
	DescriptionEN string           `json:"description_en"`
	DescriptionJA string           `json:"description_ja"`
	SpriteURL     string           `json:"sprite_url"`
	BaseStatTotal int              `json:"base_stat_total"`
	Types         []string         `json:"types"`
	Height        int              `json:"height"`
	Weight        int              `json:"weight"`
	FlavorTexts   []FlavorTextPair `json:"flavor_texts,omitempty"`
}
