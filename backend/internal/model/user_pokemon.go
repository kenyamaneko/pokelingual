package model

import "time"

// UserPokemon represents a user's encounter and capture record for a specific Pokemon.
type UserPokemon struct {
	PokemonID       int       `firestore:"pokemon_id"        json:"pokemon_id"`
	Status          string    `firestore:"status"             json:"status"`
	TotalCaptures   int       `firestore:"total_captures"     json:"total_captures"`
	TotalEncounters int       `firestore:"total_encounters"   json:"total_encounters"`
	LastCapturedAt  time.Time `firestore:"last_captured_at"   json:"last_captured_at"`
	LastEncounteredAt time.Time `firestore:"last_encountered_at" json:"last_encountered_at"`
	BestScore       float64   `firestore:"best_score"         json:"best_score"`
}
