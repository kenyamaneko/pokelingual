package model

// UserSettings holds per-user preferences such as excluded Pokemon.
type UserSettings struct {
	ExcludedPokemonIDs []int `firestore:"excluded_pokemon_ids" json:"excluded_pokemon_ids"`
}
